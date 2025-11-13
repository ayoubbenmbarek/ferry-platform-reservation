// UI Redux slice
export interface UIState {
  sidebarOpen: boolean;
  theme: 'light' | 'dark';
  language: string;
  currency: string;
  notifications: any[];
}

const initialState: UIState = {
  sidebarOpen: false,
  theme: 'light',
  language: 'en',
  currency: 'EUR',
  notifications: [],
};

// Simple reducer for now
const uiSlice = {
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar: (state: UIState) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen: (state: UIState, action: any) => {
      state.sidebarOpen = action.payload;
    },
    setTheme: (state: UIState, action: any) => {
      state.theme = action.payload;
    },
    setLanguage: (state: UIState, action: any) => {
      state.language = action.payload;
    },
    setCurrency: (state: UIState, action: any) => {
      state.currency = action.payload;
    },
    addNotification: (state: UIState, action: any) => {
      state.notifications.push(action.payload);
    },
    removeNotification: (state: UIState, action: any) => {
      state.notifications = state.notifications.filter(n => n.id !== action.payload);
    },
  },
};

export const { 
  toggleSidebar, 
  setSidebarOpen, 
  setTheme, 
  setLanguage, 
  setCurrency, 
  addNotification, 
  removeNotification 
} = uiSlice.reducers || {};

export default (state = initialState, action: any) => {
  switch (action.type) {
    case 'ui/toggleSidebar':
      return { ...state, sidebarOpen: !state.sidebarOpen };
    case 'ui/setSidebarOpen':
      return { ...state, sidebarOpen: action.payload };
    case 'ui/setTheme':
      return { ...state, theme: action.payload };
    case 'ui/setLanguage':
      return { ...state, language: action.payload };
    case 'ui/setCurrency':
      return { ...state, currency: action.payload };
    case 'ui/addNotification':
      return { ...state, notifications: [...state.notifications, action.payload] };
    case 'ui/removeNotification':
      return { ...state, notifications: state.notifications.filter(n => n.id !== action.payload) };
    default:
      return state;
  }
}; 