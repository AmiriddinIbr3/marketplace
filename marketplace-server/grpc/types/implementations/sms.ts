import { Observable } from "rxjs";
import { ISendSmsOnPhoneArgs } from "../requests/phone";
import { ISendedSms } from "../responses/phone";

export interface SmsImplementation {
    SendSmsOnPhone (request: ISendSmsOnPhoneArgs): Observable<ISendedSms>;
}