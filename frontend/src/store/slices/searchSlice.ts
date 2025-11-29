// Search Redux slice
export interface SearchState {
  searchParams: any | null;
  searchResults: any[];
  isLoading: boolean;
  error: string | null;
}

const initialState: SearchState = {
  searchParams: null,
  searchResults: [],
  isLoading: false,
  error: null,
};

// Simple reducer for now
const searchSlice = {
  name: 'search',
  initialState,
  reducers: {
    setSearchParams: (state: SearchState, action: any) => {
      state.searchParams = action.payload;
    },
    setSearchResults: (state: SearchState, action: any) => {
      state.searchResults = action.payload;
    },
    setLoading: (state: SearchState, action: any) => {
      state.isLoading = action.payload;
    },
    setError: (state: SearchState, action: any) => {
      state.error = action.payload;
    },
    clearError: (state: SearchState) => {
      state.error = null;
    },
  },
};

export const { setSearchParams, setSearchResults, setLoading, setError, clearError } = searchSlice.reducers || {};

const searchReducer = (state = initialState, action: any) => {
  switch (action.type) {
    case 'search/setSearchParams':
      return { ...state, searchParams: action.payload };
    case 'search/setSearchResults':
      return { ...state, searchResults: action.payload };
    case 'search/setLoading':
      return { ...state, isLoading: action.payload };
    case 'search/setError':
      return { ...state, error: action.payload };
    case 'search/clearError':
      return { ...state, error: null };
    default:
      return state;
  }
};

export default searchReducer; 