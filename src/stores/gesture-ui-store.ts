import { create } from "zustand";

interface GestureUiState {
  isTabSwipeActive: boolean;
  setTabSwipeActive: (active: boolean) => void;
  isHorizontalContentGestureActive: boolean;
  horizontalContentGestureOwner: symbol | null;
  beginHorizontalContentGesture: (owner: symbol) => void;
  endHorizontalContentGesture: (owner: symbol) => void;
}

export const useGestureUiStore = create<GestureUiState>((set) => ({
  isTabSwipeActive: false,
  setTabSwipeActive: (active) => set({ isTabSwipeActive: active }),
  isHorizontalContentGestureActive: false,
  horizontalContentGestureOwner: null,
  beginHorizontalContentGesture: (owner) => set((state) =>
    state.isTabSwipeActive ? state : {
      isHorizontalContentGestureActive: true,
      horizontalContentGestureOwner: owner,
    },
  ),
  endHorizontalContentGesture: (owner) => set((state) =>
    state.horizontalContentGestureOwner !== owner ? state : {
      isHorizontalContentGestureActive: false,
      horizontalContentGestureOwner: null,
    },
  ),
}));
