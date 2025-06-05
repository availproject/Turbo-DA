export interface BaseResponse<T> {
  state: "SUCCESS" | "ERROR";
  message: string;
  data?: T;
}
