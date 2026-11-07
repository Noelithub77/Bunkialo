import { requireOptionalNativeModule } from "expo";

export default requireOptionalNativeModule<{
  setSchedule(boundaries: number[]): Promise<void>;
}>("WidgetRefresh");
