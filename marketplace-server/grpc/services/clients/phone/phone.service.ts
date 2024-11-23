import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { Client, ClientGrpc, Transport } from '@nestjs/microservices';
import { catchError, firstValueFrom } from 'rxjs';
import { ISendedSms, IValidatedPhone } from 'grpc/types/responses/phone';
import { PhoneImplementation } from 'grpc/types/implementations/phone';
import { join } from 'path';
import { SmsImplementation } from 'grpc/types/implementations/sms';

@Injectable()
export class PhoneService implements OnModuleInit {
    @Client({
        transport: Transport.GRPC,
        options: {
            package: 'phone',
            protoPath: join(process.cwd(), 'grpc/phone.proto'),
            url: 'phone-service:50051',
        },
    })
    phoneClient: ClientGrpc;

    @Client({
        transport: Transport.GRPC,
        options: {
            package: 'sms',
            protoPath: join(process.cwd(), 'grpc/sms.proto'),
            url: 'phone-service:50051',
        },
    })
    smsClient: ClientGrpc;

    private phoneImplementation: PhoneImplementation;
    private smsImplementation: SmsImplementation;

    onModuleInit() {
        this.initSmsService();
        this.initPhoneService();
    }

    initSmsService(): void {
        this.smsImplementation = this.smsClient.getService<SmsImplementation>('SmsService');
    }

    initPhoneService(): void {
        this.phoneImplementation = this.phoneClient.getService<PhoneImplementation>('PhoneService');
    }

    async checkPhone(phone: string): Promise<IValidatedPhone> {
        const result: IValidatedPhone = await firstValueFrom(
            this.phoneImplementation.checkPhone({
                phoneNumber: phone,
            }).pipe(
                catchError(error => {
                    if (error.code && error.code === 14) {
                        console.log(error.details);
                        throw new BadRequestException("Server can\'t handle your request");
                    }

                    throw new BadRequestException(error.details);
                }),
            )
        )

        if (!result.valid) {
            throw new BadRequestException("Number is not valid");
        }

        return result;
    }

    async sendSmsOnPhone(phone: string, message: string): Promise<ISendedSms> {
        const result: ISendedSms = await firstValueFrom(
            this.smsImplementation.SendSmsOnPhone({
                phoneNumber: phone,
                message,
            }).pipe(
                catchError(error => {
                    if (error.code && error.code === 14) {
                        console.log(error.details);
                        throw new BadRequestException("Server can\'t handle your request");
                    }

                    throw new BadRequestException(error.details);
                }),
            )
        )

        return result;
    }
}