import { Inject, Injectable } from '@nestjs/common';
import { INoticePayload, INoticeSend, NoticeDatabaseService } from 'src/services/PrismaDB/notice/notice-database.service';
import { SeeConfig } from '../SSEConfig';
import Redis from 'ioredis';

@Injectable()
export class NotificationService extends SeeConfig<INoticeSend> {
    private readonly timeDuration = 30_000;
    private readonly pendingNoticesPrefixKey = "pendingNotices:";

    constructor(
        private readonly noticeDatabase: NoticeDatabaseService,
        @Inject('REDIS_CLIENT') private readonly redis: Redis,
    ) {
        super();
    }

    async sendNotice(userId: string, notice: INoticePayload) {
        const existingNotice = await this.noticeDatabase.findByTitleAndBodyAndUserId(userId, notice.title, notice.body);
        if (existingNotice) return;

        const { id, title, body, checked, createdAt } = await this.noticeDatabase.saveNotice(userId, notice);
        const newNotice: INoticeSend = {
            id,
            title,
            body,
            checked,
            date: createdAt,
        };

        if (this.isEventActive(userId)) {
            this.emitEvent(userId, newNotice);
        }
        else {
            const pendingNoticesKey = this.pendingNoticesPrefixKey + userId;
            const pendingNotices = await this.redis.lrange(pendingNoticesKey, 0, -1);

            pendingNotices.push(JSON.stringify(newNotice));
            await this.redis.rpush(pendingNoticesKey, JSON.stringify(newNotice));
            
            this.setTTL(userId);
        }
    }

    async handleUser(userId: string): Promise<void> {
        await this.clearTimer(userId);

        const pendingNoticesKey = this.pendingNoticesPrefixKey + userId;
        const pendingNotices = await this.redis.lrange(pendingNoticesKey, 0, -1);

        if (pendingNotices.length > 0) {
            pendingNotices.forEach(notice => {
                this.emitEvent(userId, JSON.parse(notice));
            });
            await this.redis.del(pendingNoticesKey);
        }
    }

    async deleteUser(userId: string): Promise<void> {
        await this.clearTimer(userId);
    }

    async clearTimer(userId: string) {
        const pendingNoticesKey = this.pendingNoticesPrefixKey + userId;
        await this.redis.del(pendingNoticesKey);
    }

    async setTTL(userId: string) {
        const pendingNoticesKey = this.pendingNoticesPrefixKey + userId;
        const timeInSeconds = this.timeDuration / 1000;
        await this.redis.expire(pendingNoticesKey, timeInSeconds);
    }

    async hasTimer(userId: string) {
        const pendingNoticesKey = this.pendingNoticesPrefixKey + userId;
        return await this.redis.exists(pendingNoticesKey);
    }
}