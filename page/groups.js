import { BasePage } from '@zeppos/zml/base-page'
import { px } from '@zos/utils'
import { setPageBrightTime } from '@zos/display'
import { getLogger } from '../utils/logger.js'
import { getText } from '@zos/i18n'
import { createWidget, deleteWidget, widget, align, prop } from '@zos/ui'
import { push } from '@zos/router'

const logger = getLogger('hue-groups-page')

const COLORS = {
  background: 0x000000,
  text: 0xffffff,
  highlight: 0x0055ff,
  cardBg: 0x222222,
  activeTab: 0x0055ff,
  inactiveTab: 0x1a1a1a
}

Page(
  BasePage({
    state: {
      rooms: [],
      zones: [],
      currentTab: 'ROOMS',
      isLoading: false
    },

    widgets: [],
    listWidget: null,

    onInit() {
      logger.debug('Groups page onInit')
    },

    build() {
      setPageBrightTime({ brightTime: 60000 })
      this.loadGroupsData()
    },

    createTrackedWidget(type, props) {
      const w = createWidget(type, props)
      if (!this.widgets) this.widgets = []
      this.widgets.push(w)
      return w
    },

    clearAllWidgets() {
      if (this.widgets) {
        this.widgets.forEach(w => {
          try { deleteWidget(w) } catch (e) {}
        })
      }
      this.widgets = []
      this.listWidget = null
    },

    clearListWidget() {
      if (this.listWidget) {
        try { deleteWidget(this.listWidget) } catch (e) {}
        this.listWidget = null
      }
    },

    loadGroupsData() {
      this.state.isLoading = true
      if (this.widgets.length === 0) this.renderBaseLayout()

      this.request({ method: 'GET_GROUPS' })
        .then(result => {
          if (result.success && result.data) {
            this.state.rooms = result.data.rooms || []
            this.state.zones = result.data.zones || []
            this.renderCurrentTabList()
          } else {
             this.renderErrorState('Failed to load groups')
          }
        })
        .catch(err => {
          logger.error('Load groups error:', err)
          this.renderErrorState(err.message || "Network Error")
        })
    },

    renderErrorState(msg) {
      this.clearAllWidgets()
      this.createTrackedWidget(widget.TEXT, {
        x: px(20), y: px(200), w: px(440), h: px(100),
        text: `ERRORE: ${msg}`, text_size: px(24), color: 0xFF0000,
        align_h: align.CENTER_H, align_v: align.CENTER_V
      })
      this.createTrackedWidget(widget.BUTTON, {
        x: px(140), y: px(350), w: px(200), h: px(60),
        text: 'RETRY', normal_color: COLORS.highlight, press_color: 0x333333,
        click_func: () => this.loadGroupsData()
      })
    },

    renderBaseLayout() {
      this.clearAllWidgets()

      this.createTrackedWidget(widget.FILL_RECT, {
        x: 0, y: 0, w: px(480), h: px(480), color: COLORS.background
      })

      this.createTrackedWidget(widget.TEXT, {
        x: 0, y: px(10), w: px(480), h: px(40),
        text: 'Hue Groups', text_size: px(36),
        color: COLORS.text, align_h: align.CENTER_H
      })

      this.renderTabs()

      this.createTrackedWidget(widget.BUTTON, {
        x: px(140), y: px(420), w: px(200), h: px(50),
        text: 'REFRESH', radius: px(25),
        normal_color: 0x333333, press_color: COLORS.highlight,
        click_func: () => this.loadGroupsData()
      })
    },

    renderTabs() {
      const tabY = px(60)
      const tabH = px(50)
      const tabW = px(200)

      const isRooms = this.state.currentTab === 'ROOMS'
      this.createTrackedWidget(widget.BUTTON, {
        x: px(30), y: tabY, w: tabW, h: tabH,
        text: getText('ROOMS'),
        color: isRooms ? 0xFFFFFF : 0xAAAAAA,
        normal_color: isRooms ? COLORS.activeTab : COLORS.inactiveTab,
        press_color: COLORS.highlight,
        radius: px(10),
        click_func: () => this.switchTab('ROOMS')
      })

      const isZones = this.state.currentTab === 'ZONES'
      this.createTrackedWidget(widget.BUTTON, {
        x: px(250), y: tabY, w: tabW, h: tabH,
        text: getText('ZONES'),
        color: isZones ? 0xFFFFFF : 0xAAAAAA,
        normal_color: isZones ? COLORS.activeTab : COLORS.inactiveTab,
        press_color: COLORS.highlight,
        radius: px(10),
        click_func: () => this.switchTab('ZONES')
      })
    },

    switchTab(tabName) {
      if (this.state.currentTab === tabName) return
      this.state.currentTab = tabName

      this.renderTabs()
      this.renderCurrentTabList()
    },

    renderCurrentTabList() {
      this.clearListWidget()

      const data = this.state.currentTab === 'ROOMS' ? this.state.rooms : this.state.zones

      const listData = data.map(item => ({
        name: item.name,
        status: `${item.lights?.length || 0} luci`,
        on_off: (item.anyOn === true) ? 'ON' : 'OFF',
        raw: item
      }))

      if (listData.length === 0) {
        this.listWidget = this.createTrackedWidget(widget.TEXT, {
          x: 0, y: px(200), w: px(480), h: px(50),
          text: `Nessuna ${this.state.currentTab === 'ROOMS' ? 'stanza' : 'zona'} trovata`,
          text_size: px(24), color: 0x666666,
          align_h: align.CENTER_H
        })
        return
      }

      logger.log(`RENDER: ${this.state.currentTab} list items:`, listData.map(d => d.name).join(', '))

      const dataConfig = [{ start: 0, end: listData.length - 1, type_id: 1 }]

      // 1. LA LISTA (Creazione del widget CON dati e con px() ovunque sia possibile)
      this.listWidget = this.createTrackedWidget(widget.SCROLL_LIST, {
        x: 0,
        y: px(120),
        w: px(480),
        h: px(290),
        item_space: px(10), // px() reintrodotto

        item_config: [{
          type_id: 1,
          item_bg_color: COLORS.cardBg,
          item_bg_radius: px(10), // px() reintrodotto
          text_view: [
            // TUTTI i valori di posizione/dimensione usano px()
            { x: px(20), y: px(20), w: px(280), h: px(30), key: 'name', color: 0xFFFFFF, text_size: px(28), action: true }, // action: true per sicurezza
            { x: px(20), y: px(55), w: px(200), h: px(25), key: 'status', color: 0xAAAAAA, text_size: px(20) },
            { x: px(340), y: px(30), w: px(100), h: px(40), key: 'on_off', color: 0xFFFFFF, text_size: px(28) }
          ],
          text_view_count: 3,
          image_view: [],
          image_view_count: 0,
          item_height: px(100) // px() reintrodotto
        }],
        item_config_count: 1, // Esplicito

        // 2. DATI BINDING IMMEDIATO (come nell'esempio ufficiale)
        data_type_config: dataConfig,
        data_type_config_count: dataConfig.length,
        data_array: listData,
        data_count: listData.length,

        // 3. FUNZIONE CLICK IMMEDIATA (come nell'esempio ufficiale)
        item_click_func: (list, index) => {
            const item = listData[index]
            logger.debug('item >',{
                    groupId: item.raw.id,
                    groupType: item.raw.type,
                    groupName: item.raw.name
                })
            const paramsString = JSON.stringify({
                groupId: item.raw.id,
                    groupType: item.raw.type,
                    groupName: item.raw.name
            })
            push({
                url: 'page/group-detail',
                params: paramsString
            })
        }
      })

      // Rimosso il safety check superfluo e setProperty inutile.

      if (!this.listWidget) {
         logger.error("FATAL: SCROLL_LIST creation failed (this.listWidget is null) even after final fix.");
      }
    },

    onDestroy() {
      this.clearAllWidgets()
    }
  })
)