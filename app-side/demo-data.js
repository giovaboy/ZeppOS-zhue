// The demo mode's home (settings: demo on): three rooms, zones, lights and
// scenes the phone plays with instead of a bridge (HueBridgeManager.DEMO_STATE).
// Moved here from utils/constants.js, which only the phone read it from
export const DEMO_DATA = {
  lights: {
    // --- LIVING ROOM (Colors & Ambiance) ---
    '1': {
      id: '1',
      name: 'Sofa Floor Lamp',
      ison: true,
      bri: 200,
      hue: 46920, // Blue-ish
      sat: 254,
      ct: 0,
      colormode: 'hs',
      reachable: true,
      modelid: 'LCT015' // A19 Color Gen 3
    },
    '2': {
      id: '2',
      name: 'TV Backlight',
      ison: true,
      bri: 254,
      hue: 65000, // Red
      sat: 254,
      ct: 0,
      colormode: 'hs',
      reachable: true,
      modelid: 'LJL001' // Play Bar
    },
    '3': {
      id: '3',
      name: 'Ceiling Spots',
      ison: false,
      bri: 100,
      ct: 366,
      colormode: 'ct',
      reachable: true,
      modelid: 'LTW001'
    },

    // --- KITCHEN (Functional - White Ambiance) ---
    '4': {
      id: '4',
      name: 'Cabinet Strip',
      ison: true,
      bri: 254,
      ct: 250, // Neutral white
      colormode: 'ct',
      reachable: true,
      modelid: 'LST002' // Lightstrip Plus
    },
    '5': {
      id: '5',
      name: 'Dining Table',
      ison: true,
      bri: 180,
      ct: 450, // Warm white
      colormode: 'ct',
      reachable: true,
      modelid: 'LTW001'
    },

    // --- BEDROOM (Relax) ---
    '6': {
      id: '6',
      name: 'Left Bedside',
      ison: false,
      bri: 50,
      hue: 10000,
      sat: 200,
      colormode: 'hs',
      reachable: true,
      modelid: 'LCT015'
    },
    '7': {
      id: '7',
      name: 'Right Bedside',
      ison: false,
      bri: 50,
      ct: 400,
      colormode: 'ct',
      reachable: true,
      modelid: 'LCT015'
    },

    // --- GARAGE (Only ON/OFF - White) ---
    '8': {
      id: '8',
      name: 'Ceiling Light 1',
      ison: true,
      bri: 254,
      colormode: 'bri',
      reachable: true,
      modelid: 'LWB014' // Hue White
    },
    '9': {
      id: '9',
      name: 'Ceiling Light 2',
      ison: true,
      bri: 254,
      colormode: 'bri',
      reachable: true,
      modelid: 'LWB014'
    },

    // --- GARDEN (Connection issues) ---
    '10': {
      id: '10',
      name: 'Path Bollard',
      ison: true,
      bri: 150,
      hue: 40000,
      sat: 254,
      colormode: 'hs',
      reachable: true,
      modelid: 'LCA007' // Calla Outdoor
    },
    '11': {
      id: '11',
      name: 'Tree Spot (Lost)',
      ison: true, // Appears ON but no signal
      bri: 254,
      colormode: 'bri',
      reachable: false,
      modelid: 'LPA001'
    },

    // --- ATTIC (All off/unreachable) ---
    '12': {
      id: '12',
      name: 'Old Lamp',
      ison: true,
      bri: 254,
      colormode: 'bri',
      reachable: false,
      modelid: 'LWB006'
    },

    // --- GAMING ROOM (Entertainment) ---
    '13': {
      id: '13',
      name: 'PC Gradient Strip',
      ison: true,
      bri: 200,
      hue: 55000, // Magenta
      sat: 254,
      colormode: 'hs',
      reachable: true,
      modelid: 'LCG002' // Gradient Strip
    }
  },

  groups: {
    // --- ROOMS ---
    '1': {
      id: '1',
      name: 'Living Room',
      type: 'Room',
      class: 'Living room', // Icon: Sofa
      lights: ['1', '2', '3'],
      state: { all_on: false, any_on: true }
    },
    '2': {
      id: '2',
      name: 'Kitchen',
      type: 'Room',
      class: 'Kitchen', // Icon: Kitchen
      lights: ['4', '5'],
      state: { all_on: true, any_on: true }
    },
    '3': {
      id: '3',
      name: 'Bedroom',
      type: 'Room',
      class: 'Bedroom', // Icon: Bed
      lights: ['6', '7'],
      state: { all_on: false, any_on: false }
    },
    '4': {
      id: '4',
      name: 'Garage',
      type: 'Room',
      class: 'Garage', // Icon: Car
      lights: ['8', '9'],
      state: { all_on: true, any_on: true }
    },
    '5': {
      id: '5',
      name: 'Garden',
      type: 'Room',
      class: 'Garden', // Icon: Flower/Tree
      lights: ['10', '11'],
      state: { all_on: true, any_on: true } // Note: 11 is unreachable but 10 is on
    },
    '6': {
      id: '6',
      name: 'Gaming Room',
      type: 'Room',
      class: 'Man cave', // Icon: Controller/PC
      lights: ['13'],
      state: { all_on: true, any_on: true }
    },
    '7': {
      id: '7',
      name: 'Attic',
      type: 'Room',
      class: 'Attic', // Icon: Roof/Box
      lights: ['12'],
      state: { all_on: false, any_on: true }, // Fake ON (ghost light)
      allUnreachable: true // ⚠️ TEST FLAG
    },

    // --- ZONES ---
    '100': {
      id: '100',
      name: 'Downstairs',
      type: 'Zone',
      class: 'Downstairs', // Icon: Stairs Down
      lights: ['1', '2', '3', '4', '5', '8', '9'],
      state: { all_on: false, any_on: true }
    },
    '101': {
      id: '101',
      name: 'Game Mode',
      type: 'Zone',
      class: 'TV',
      lights: ['1', '2', '13'],
      state: { all_on: true, any_on: true }
    }
  },

  scenes: {
    's1': { id: 's1', name: 'Cinema', group: '1', color: '#FF0000' },
    's2': { id: 's2', name: 'Concentrate', group: '1', color: '#F5F5F5' },
    's3': { id: 's3', name: 'Cooking', group: '2', color: '#FFFFFF' },
    's4': { id: 's4', name: 'Nightlight', group: '3', color: '#111111' },
    's5': { id: 's5', name: 'Cyberpunk', group: '6', color: '#00FFFF' },
    's6': { id: 's6', name: 'Sunset', group: '5', color: '#FF8800' }
  }
}
