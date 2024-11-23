export interface IValidatedPhone {
    phoneNumber: string,
    valid: boolean,
    countryCode: string;
}

export interface ISendedSms {
    phoneNumber: string,
    sended: boolean,
}