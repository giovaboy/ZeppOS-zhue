import { BasePage } from '@zeppos/zml/base-page'
import { px } from '@zos/utils'
import { setScrollLock } from '@zos/page'
import { createWidget, deleteWidget, prop } from '@zos/ui'
import { back } from '@zos/router'
import { onGesture, GESTURE_RIGHT } from '@zos/interaction'
import { getLogger } from '../utils/logger.js'
import { HUE_RANGE, SAT_RANGE, BRI_RANGE, CT_MIN, CT_MAX, hsb2hex, ct2hex } from '../utils/constants.js'

// Import Layout
import { renderColorPickerPage, LAYOUT_CONFIG } from 'zosLoader:./color-picker.[pf].layout.js'

const logger = getLogger('zhue-color-picker-page')
const app = getApp()

Page(
    BasePage({
        state: {
            lightId: null,
            // Valori correnti
            hue: 0,
            sat: 0,
            bri: 0,
            ct: 370,
            // Capabilities
            supportsColor: false,
            supportsCT: false,
            // UI State
            mode: 'color', // 'color' o 'ct'
            isDragging: false,
            // Widget refs (popolati dal layout)
            cursorWidget: null,
            ctCursorWidget: null,
            briFillWidget: null,
            brightnessLabel: null
        },

        widgets: [],
        exitGestureListener: null, // Riferimento al listener per lo swipe di uscita

        onInit(p) {
            logger.log('Color Picker Init', p);
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
        },

        build() {
            // BLOCCA SCROLLING
            setScrollLock({ lock: true });
            // Imposta la gesture di uscita standard
            this.unlockExitGesture();
            this.render();
        },

        // --- GESTURE LOCK LOGIC ---

        // La funzione di uscita che viene allegata al listener di ZeppOS
        exitOnSwipe(event) {
            if (event === GESTURE_RIGHT) {
                back();
                return true;
            }
            return false;
        },

        /** Blocca lo swipe laterale per l'uscita rimuovendo il listener. */
        lockExitGesture() {
            if (this.exitGestureListener) {
                this.exitGestureListener(); // Rimuove il listener
                this.exitGestureListener = null;
                logger.debug('Exit gesture LOCKED');
            }
        },

        /** Ripristina lo swipe laterale per l'uscita. */
        unlockExitGesture() {
            if (this.exitGestureListener) {
                this.exitGestureListener(); // Rimuove il precedente se esiste
            }
            // Crea un nuovo listener e salva il suo distruttore (unlistener)
            this.exitGestureListener = onGesture({
                callback: (event) => this.exitOnSwipe(event)
            });
            logger.debug('Exit gesture UNLOCKED');
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
            this.state.cursorWidget = null;
            this.state.ctCursorWidget = null;
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
            const { pickerX, pickerY, pickerSize } = LAYOUT_CONFIG;

            // Calcolo valori da coordinate
            const calcValues = (x, y) => {
                let nX = (x - pickerX) / pickerSize;
                let nY = (y - pickerY) / pickerSize;
                nX = Math.max(0, Math.min(1, nX));
                nY = Math.max(0, Math.min(1, nY));

                return {
                    hue: Math.round(nX * HUE_RANGE),
                    sat: Math.round((1 - nY) * SAT_RANGE) // Y invertita (in alto sat max)
                };
            };

            if (evt === 'DOWN') {
                this.lockExitGesture(); // BLOCCA GESTURE
                this.state.isDragging = true;
                const vals = calcValues(info.x, info.y);
                this.updateColorUI(vals.hue, vals.sat);
                this.sendColor(vals.hue, vals.sat, false); // Instant response? Opzionale
            } else if (evt === 'MOVE' && this.state.isDragging) {
                const vals = calcValues(info.x, info.y);
                this.updateColorUI(vals.hue, vals.sat);
                // Throttle API calls here usually, or send only on UP
            } else if (evt === 'UP') {
                this.unlockExitGesture(); // SBLOCCA GESTURE
                this.state.isDragging = false;
                const vals = calcValues(info.x, info.y);
                this.sendColor(vals.hue, vals.sat, true); // Final send
            }
        },

        updateColorUI(h, s) {
            this.state.hue = h;
            this.state.sat = s;
            if (this.state.cursorWidget) {
                const { pickerX, pickerY, pickerSize } = LAYOUT_CONFIG;
                const x = pickerX + (h / HUE_RANGE) * pickerSize;
                const y = pickerY + ((SAT_RANGE - s) / SAT_RANGE) * pickerSize;
                this.state.cursorWidget.setProperty(prop.CENTER_X, x);
                this.state.cursorWidget.setProperty(prop.CENTER_Y, y);
                const cursorHex = hsb2hex(
                    (h / HUE_RANGE) * 360,
                    (s / SAT_RANGE) * 100,
                    90 //(this.state.bri / BRI_RANGE) * 100
                );
                this.state.cursorWidget.setProperty(prop.COLOR, cursorHex);
            }
        },

        sendColor(h, s, force) {
            // Se non è force (MOVE), magari saltiamo per non floodare, oppure usiamo throttle
            if (!force) return;

            this.request({
                method: 'SET_HS',
                params: { lightId: this.state.lightId, hue: h, sat: s, bri: this.state.bri }
            }).then(() => {
                // ✅ AGGIORNA LA CACHE PRIMA DI TORNARE
                const light = app.getLightData(this.state.lightId)
                if (light) {
                    const nBri = Math.round((this.state.bri / BRI_RANGE) * 100)
                    const nHue = Math.round((h / HUE_RANGE) * 360)
                    const nSat = Math.round((s / SAT_RANGE) * 100)
                    const rgb = hsb2hex(nHue, nSat, nBri)
                    const newHex = '#' + rgb.toString(16).padStart(6, '0').toUpperCase()
                    light.hue = h;
                    light.sat = s;
                    light.colormode = 'hs';
                    light.hex = newHex;

                    this.updateLight(light)
                }
            }).catch(e => logger.error(e));
        },

        // --- LOGICA DRAG CT (Temperatura) ---
        handleCTDrag(evt, info) {
            const { pickerX, pickerY, pickerSize } = LAYOUT_CONFIG;

            const calcCT = (y) => {
                let nY = (y - pickerY) / pickerSize;
                nY = Math.max(0, Math.min(1, nY));
                // 0 = Freddo (CT_MIN), 1 = Caldo (CT_MAX)
                return Math.round(CT_MIN + nY * (CT_MAX - CT_MIN));
            };

            if (evt === 'DOWN') {
                this.lockExitGesture(); // BLOCCA GESTURE
                this.state.isDragging = true;
                const val = calcCT(info.y);
                this.updateCTUI(val);
            } else if (evt === 'MOVE' && this.state.isDragging) {
                const val = calcCT(info.y);
                this.updateCTUI(val);
            } else if (evt === 'UP') {
                this.unlockExitGesture(); // SBLOCCA GESTURE
                this.state.isDragging = false;
                const val = calcCT(info.y);
                this.sendCT(val);
            }
        },

        updateCTUI(ctVal) {
            this.state.ct = ctVal;
            if (this.state.ctCursorWidget) {
                const { pickerY, pickerSize } = LAYOUT_CONFIG;
                const nY = (ctVal - CT_MIN) / (CT_MAX - CT_MIN);
                const y = pickerY + nY * pickerSize - px(18); // center
                this.state.ctCursorWidget.setProperty(prop.Y, y);
            }
        },

        sendCT(ctVal) {
            this.request({
                method: 'SET_COLOR', // General method usually handles ct too
                params: {
                    lightId: this.state.lightId,
                    ct: ctVal,
                    bri: this.state.bri,
                    hue: null,
                    sat: null // Reset color mode logic in API handler if needed
                }
            }).then(() => {
                // ✅ AGGIORNA LA CACHE PRIMA DI TORNARE
                const light = app.getLightData(this.state.lightId)
                if (light) {
                    const rgb = ct2hex(ctVal)
                    const newHex = '#' + rgb.toString(16).padStart(6, '0').toUpperCase()

                    light.ct = ctVal
                    light.colormode = 'ct'
                    light.hex = newHex

                    this.updateLight(light)
                }
            }).catch(e => logger.error(e));
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
                this.lockExitGesture(); // BLOCCA GESTURE
                this.state.isDragging = true;
                const val = calcBri(info.x);
                this.updateBriUI(val);
            } else if (evt === 'MOVE' && this.state.isDragging) {
                const val = calcBri(info.x);
                this.updateBriUI(val);
            } else if (evt === 'UP') {
                this.unlockExitGesture(); // SBLOCCA GESTURE
                this.state.isDragging = false;
                const val = calcBri(info.x);
                this.sendBri(val);
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

        sendBri(val) {
            this.request({
                method: 'SET_BRIGHTNESS',
                params: { lightId: this.state.lightId, bri: val }
            }).then(() => {
                // ✅ AGGIORNA LA CACHE PRIMA DI TORNARE
                const light = app.getLightData(this.state.lightId)
                if (light) {
                    light.bri = val
                    this.updateLight(light)
                }
            }).catch(e => logger.error(e));
        },

        updateLight(light) {
            // Sincronizza con globalData
            app.setLightData(this.state.lightId, light)
            app.updateLightStatusInGroupsCache(this.state.lightId, light)
        },

        onDestroy() {
            this.unlockExitGesture();
            setScrollLock({ lock: false });
        }
    })
)