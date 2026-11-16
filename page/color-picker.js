import { BasePage } from '@zeppos/zml/base-page'
import { countCommands } from '../utils/commands.js'
import { loggedPage, devLog, LOG_TRACE } from '../utils/remote-log.js'
import { createGate } from '../utils/request-gate.js'
import { px } from '@zos/utils'
import { setScrollLock } from '@zos/page'
import { keepScreenOn } from '../utils/screen.js'
import { createWidget, deleteWidget, prop } from '@zos/ui'
import { back } from '@zos/router'
import { createDragGuard } from '../utils/drag-guard.js'
import { onKey, KEY_SELECT, KEY_BACK, KEY_EVENT_CLICK } from '@zos/interaction'
import { getLogger } from '../utils/logger.js'
import { HUE_RANGE, SAT_RANGE, BRI_RANGE, hsb2hex, ct2hexString } from '../utils/constants.js'

// Import Layout
import { renderColorPickerPage, LAYOUT_CONFIG, kelvinText } from 'zosLoader:./color-picker.[pf].layout.js'
import { xyToHs, xyToCt, moveHsCursor, moveCtCursor } from './layouts/wheel.js'

const logger = getLogger('zhue-color-picker-page')
const app = getApp()

Page(
    loggedPage('color-picker', countCommands(BasePage({
        state: {
            lightId: null,
            hue: 0,
            sat: 0,
            bri: 0,
            ct: 370,
            supportsColor: false,
            supportsCT: false,
            mode: 'color',
            isDragging: false,
            cursorWidgets: null,
            ctCursorWidgets: null,
            kelvinLabel: null,
            briFillWidget: null,
            brightnessLabel: null
        },

        widgets: [],

        onInit(p) {
            logger.log('Color Picker Init', p);
            // BasePage shares `state` between instances of this page: what a
            // previous picker left (a drag, widget handles) is reset here
            Object.assign(this.state, {
                isDragging: false,
                cursorWidgets: null,
                ctCursorWidgets: null,
            kelvinLabel: null,
                briFillWidget: null,
                brightnessLabel: null
            });
            this.widgets = [];
            this._gate = createGate('color-picker');
            let params = {};
            try { params = JSON.parse(p) } catch (e) { params = p || {} }

            this.state.lightId = params.lightId;
            this.state.hue = params.hue || 0;
            this.state.sat = params.sat || 0;
            this.state.bri = params.bri || 100;
            this.state.ct = params.ct || 370; // Default warm-ish

            // Parse capabilities semplici passate come stringa o array
            const caps = params.caps || [];
            this.state.supportsColor = caps.includes('color');
            // Quasi tutte le luci Hue supportano bri, controlliamo se supportano temperatura colore
            // Se è "Color light" (vecchie) potrebbe non avere buon CT, ma "Extended color" sì.
            // Assumiamo che se ha "color" ha anche "ct" a meno che non sia specificato diversamente.
            // O controlliamo il parametro 'supportsCT' esplicito se lo passiamo.
            this.state.supportsCT = caps.includes('ct') || caps.includes('color_temperature') || true;

            // Decide initial mode
            if (params.initialMode) {
                this.state.mode = params.initialMode;
            } else {
                this.state.mode = this.state.supportsColor ? 'color' : 'ct';
            }

            // The cached light fills in what the params left out
            const cachedLight = app.getLightData(this.state.lightId)
            if (cachedLight) {
                logger.debug('Color picker using cached light data')
                // Sincronizza valori se diversi da params
                if (!params.hue && cachedLight.hue) this.state.hue = cachedLight.hue
                if (!params.sat && cachedLight.sat) this.state.sat = cachedLight.sat
                if (!params.bri && cachedLight.bri) this.state.bri = cachedLight.bri
                if (!params.ct && cachedLight.ct) this.state.ct = cachedLight.ct
            }
        },

        build() {
            // The screen stays on 60 s, as on the other pages (it had no time
            // of its own: the system's, shorter, applied here)
            keepScreenOn('color-picker');
            setScrollLock({ lock: true });
            // The page's one onGesture: right swipe goes back, not while the
            // picker or a slider is dragged (utils/drag-guard.js)
            this._drag = createDragGuard('color-picker');
            // Physical buttons: SELECT and BACK both close the page (the
            // color is already sent as it is picked). Nothing to move between:
            // the wheel and the slider are dragged
            onKey({
                callback: (key, keyEvent) => {
                    if ((key === KEY_SELECT || key === KEY_BACK) && keyEvent === KEY_EVENT_CLICK) {
                        if (LOG_TRACE) devLog(`[keys] color-picker: ${key === KEY_SELECT ? 'select' : 'back'} closes`);
                        back();
                        return true;
                    }
                    return false;
                }
            });
            this.render();
        },

        createTrackedWidget(type, props) {
            const w = createWidget(type, props);
            this.widgets.push(w);
            return w;
        },

        clearWidgets() {
            this.widgets.forEach(w => {
                try { deleteWidget(w) } catch (e) {
                    logger.error('clearWidgets error:', e);
                }
            });
            this.widgets = [];
            this.state.cursorWidgets = null;
            this.state.ctCursorWidgets = null;
            this.state.kelvinLabel = null;
            this.state.briFillWidget = null;
            this.state.brightnessLabel = null;
        },

        render() {
            this.clearWidgets();
            renderColorPickerPage(this, this.state, {
                onTabSwitch: (mode) => {
                    this.state.mode = mode;
                    this.render(); // Ridisegna tutto per cambiare picker
                },
                onDragColor: (evt, info) => this.handleColorDrag(evt, info),
                onDragCT: (evt, info) => this.handleCTDrag(evt, info),
                onDragBri: (evt, info) => this.handleBriDrag(evt, info)
            });
        },

        // --- LOGICA DRAG COLOR (Hue/Sat) ---
        handleColorDrag(evt, info) {
            // A point on the color wheel → hue, sat (layouts/wheel.js)
            const calcValues = (x, y) => xyToHs(LAYOUT_CONFIG.wheel, x, y);

            if (evt === 'DOWN') {
                if (this._drag) this._drag.start();
                this.state.isDragging = true;
                const vals = calcValues(info.x, info.y);
                this.updateColorUI(vals.hue, vals.sat);
            } else if (evt === 'MOVE' && this.state.isDragging) {
                if (this._drag) this._drag.move();
                const vals = calcValues(info.x, info.y);
                this.updateColorUI(vals.hue, vals.sat);
                this.sendColor(vals.hue, vals.sat, false); // live: the light follows
            } else if (evt === 'UP') {
                if (this._drag) this._drag.end();
                this.state.isDragging = false;
                const vals = calcValues(info.x, info.y);
                this.updateColorUI(vals.hue, vals.sat);
                this.sendColor(vals.hue, vals.sat); // Final send
            }
        },

        updateColorUI(h, s) {
            this.state.hue = h;
            this.state.sat = s;
            moveHsCursor(this, LAYOUT_CONFIG.wheel, h, s);
        },

        // While dragging (final false) the light follows the finger: each move
        // goes through the request queue, where only the latest value waits
        // behind the one in flight (one request at a time, at the pace of the
        // Bluetooth link); the same value isn't sent twice. On release (final)
        // the last value is sent and the cache updated.
        liveSend(kind, value, final, send) {
            const last = this._lastSent || (this._lastSent = {});
            const text = JSON.stringify(value);
            if (!final && last[kind] === text) return;
            last[kind] = text;
            send();
        },

        sendColor(h, s, final = true) {
            if (!final) {
                // bri read when the request leaves: a queued color must not bring back
                // the brightness it was queued with (the slider may have moved since)
                this.liveSend('color', [h, s, this.state.bri], false, () => this._gate.run('color', () => this.request({
                    method: 'SET_HS',
                    params: { lightId: this.state.lightId, hue: h, sat: s, bri: this.state.bri }
                }).catch(e => logger.error(e)), true));
                return;
            }
            this._lastSent = null;
            // ✅ SEMPRE aggiorna cache locale (UI feedback immediato)
            const light = app.getLightData(this.state.lightId)
            if (light) {
                const nBri = Math.round((this.state.bri / BRI_RANGE) * 100)
                const nHue = Math.round((h / HUE_RANGE) * 360)
                const nSat = Math.round((s / SAT_RANGE) * 100)
                const rgb = hsb2hex(nHue, nSat, nBri)
                const newHex = '#' + rgb.toString(16).padStart(6, '0').toUpperCase()

                light.hue = h
                light.sat = s
                light.bri = this.state.bri
                light.colormode = 'hs'
                light.hex = newHex

                this.updateLight(light)
            }
            // Color and white share one slot: while one is in flight only the
            // latest choice waits, so the light ends on what was picked last
            // bri read when the request leaves: a queued color must not bring back
            // the brightness it was queued with (the slider may have moved since)
            this._gate.run('color', () => this.request({
                method: 'SET_HS',
                params: { lightId: this.state.lightId, hue: h, sat: s, bri: this.state.bri }
            }).catch(e => logger.error(e)), true);
        },

        // --- LOGICA DRAG CT (Temperatura) ---
        handleCTDrag(evt, info) {
            // The white wheel: warm at the top, cold at the bottom; the cursor
            // follows the finger (layouts/wheel.js)
            const calcCT = (x, y) => xyToCt(LAYOUT_CONFIG.wheel, x, y);

            if (evt === 'DOWN') {
                if (this._drag) this._drag.start();
                this.state.isDragging = true
                const val = calcCT(info.x, info.y);
                this.updateCTUI(val.ct, val.x, val.y);
            } else if (evt === 'MOVE' && this.state.isDragging) {
                if (this._drag) this._drag.move();
                const val = calcCT(info.x, info.y);
                this.updateCTUI(val.ct, val.x, val.y);
                this.sendCT(val.ct, false) // live: the light follows
            } else if (evt === 'UP') {
                if (this._drag) this._drag.end();
                this.state.isDragging = false;
                const val = calcCT(info.x, info.y);
                this.updateCTUI(val.ct, val.x, val.y);
                this.sendCT(val.ct);
            }
        },

        // x, y: the cursor's point (where the finger is)
        updateCTUI(ctVal, x, y) {
            this.state.ct = ctVal
            moveCtCursor(this, LAYOUT_CONFIG.wheel, ctVal, x, y);
            if (this.state.kelvinLabel) {
                try { this.state.kelvinLabel.setProperty(prop.TEXT, kelvinText(ctVal)) } catch (e) {}
            }
        },

        sendCT(ctVal, final = true) {
            if (!final) {
                // bri read when the request leaves: a queued color must not bring back
                // the brightness it was queued with (the slider may have moved since)
                this.liveSend('color', ['ct', ctVal, this.state.bri], false, () => this._gate.run('color', () => this.request({
                    method: 'SET_COLOR',
                    params: { lightId: this.state.lightId, ct: ctVal, bri: this.state.bri, hue: null, sat: null }
                }).catch(e => logger.error('Set CT error:', e)), true))
                return
            }
            this._lastSent = null
            // ✅ SEMPRE aggiorna cache locale
            const light = app.getLightData(this.state.lightId)
            if (light) {
                const newHex = ct2hexString(ctVal)

                light.ct = ctVal
                light.bri = this.state.bri
                light.colormode = 'ct'
                light.hex = newHex

                this.updateLight(light)
            }

            // bri read when the request leaves: a queued color must not bring back
            // the brightness it was queued with (the slider may have moved since)
            this._gate.run('color', () => this.request({
                method: 'SET_COLOR', // General method usually handles ct too
                params: {
                    lightId: this.state.lightId,
                    ct: ctVal,
                    bri: this.state.bri,
                    hue: null,
                    sat: null
                }
            }).catch(e => logger.error('Set CT error:', e)), true)
        },

        // --- LOGICA DRAG BRI (Luminosità) ---
        handleBriDrag(evt, info) {
            const { sliderX, sliderW } = LAYOUT_CONFIG;

            const calcBri = (x) => {
                let nX = (x - sliderX) / sliderW;
                nX = Math.max(0, Math.min(1, nX));
                return Math.round(nX * BRI_RANGE);
            };

            if (evt === 'DOWN') {
                if (this._drag) this._drag.start();
                this.state.isDragging = true
                const val = calcBri(info.x)
                this.updateBriUI(val)
            } else if (evt === 'MOVE' && this.state.isDragging) {
                if (this._drag) this._drag.move();
                const val = calcBri(info.x)
                this.updateBriUI(val)
                this.sendBri(val, false) // live: the light follows
            } else if (evt === 'UP') {
                if (this._drag) this._drag.end();
                this.state.isDragging = false
                const val = calcBri(info.x)
                this.sendBri(val)
            }
        },

        updateBriUI(val) {
            this.state.bri = val;
            if (this.state.briFillWidget) {
                const w = Math.max(px(20), (val / BRI_RANGE) * LAYOUT_CONFIG.sliderW);
                this.state.briFillWidget.setProperty(prop.W, w);
            }
            if (this.state.brightnessLabel) {
                const brightnessPercent = Math.round(val / BRI_RANGE * 100);
                this.state.brightnessLabel.setProperty(prop.TEXT, `${brightnessPercent}%`);
            }
        },

        sendBri(val, final = true) {
            if (!final) {
                this.liveSend('brightness', val, false, () => this._gate.run('brightness', () => this.request({
                    method: 'SET_BRIGHTNESS',
                    params: { lightId: this.state.lightId, bri: val }
                }).catch(e => logger.error('Set brightness error:', e)), true))
                return
            }
            this._lastSent = null
            // ✅ SEMPRE aggiorna cache locale
            const light = app.getLightData(this.state.lightId)
            if (light) {
                light.bri = val
                this.updateLight(light)
            }

            this._gate.run('brightness', () => this.request({
                method: 'SET_BRIGHTNESS',
                params: { lightId: this.state.lightId, bri: val }
            }).catch(e => logger.error('Set brightness error:', e)), true)
        },

        updateLight(light) {
            // Sincronizza con globalData
            app.setLightData(this.state.lightId, light)
            app.updateLightStatusInGroupsCache(this.state.lightId, light)
        },

        onDestroy() {
            if (this._gate) this._gate.close();
            this.clearWidgets();
        }
    })))
)
