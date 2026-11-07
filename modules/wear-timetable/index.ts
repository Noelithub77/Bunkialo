import { requireOptionalNativeModule } from "expo";

export interface WearTimetableModule {
  isAvailable(): Promise<boolean>;
  sendTimetable(payload: string): Promise<void>;
}

const WearTimetable = requireOptionalNativeModule<WearTimetableModule>(
  "WearTimetable",
);

export default WearTimetable;
