import { create } from "zustand";

interface GestureUiState {
  isTabSwipeActive: boolean;
  setTabSwipeActive: (active: boolean) => void;
  isHorizontalContentGestureActive: boolean;
  setHorizontalContentGestureActive: (active: boolean) => void;
}

export const useGestureUiStore = create<GestureUiState>((set) => ({
  isTabSwipeActive: false,
  setTabSwipeActive: (active) => set({ isTabSwipeActive: active }),
  isHorizontalContentGestureActive: false,
  setHorizontalContentGestureActive: (active) =>
    set({ isHorizontalContentGestureActive: active }),
}));
