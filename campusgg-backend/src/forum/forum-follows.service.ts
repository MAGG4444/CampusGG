import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { ForumChannel } from './forum-channel.entity';
import { ForumChannelFollow } from './forum-channel-follow.entity';
import { ForumService } from './forum.service';

@Injectable()
export class ForumFollowsService {
  constructor(
    @InjectRepository(ForumChannelFollow)
    private readonly follows: Repository<ForumChannelFollow>,
    @InjectRepository(ForumChannel)
    private readonly channels: Repository<ForumChannel>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly forum: ForumService,
  ) {}

  private async channel(slug: string) {
    const channel = await this.channels.findOneBy({ slug: slug.toLowerCase() });
    if (!channel) throw new NotFoundException('Forum channel not found');
    return channel;
  }

  async list(userId: string) {
    const follows = await this.follows.find({
      where: { userId },
      relations: { channel: true },
      order: { channel: { name: 'ASC', id: 'ASC' } },
    });
    return follows.map(({ channel }) => ({
      id: channel.id,
      slug: channel.slug,
      name: channel.name,
    }));
  }

  async status(userId: string, slug: string) {
    const channel = await this.channel(slug);
    return {
      following: await this.follows.existsBy({ userId, channelId: channel.id }),
    };
  }

  async set(userId: string, slug: string, following: boolean) {
    const channel = await this.channel(slug);
    const user = await this.users.findOneBy({ id: userId, eduVerified: true });
    if (!user) throw new ForbiddenException('A verified account is required');
    if (following) {
      await this.follows
        .createQueryBuilder()
        .insert()
        .into(ForumChannelFollow)
        .values({ userId, channelId: channel.id })
        .orIgnore()
        .execute();
    } else {
      await this.follows.delete({ userId, channelId: channel.id });
    }
    return {
      following: await this.follows.existsBy({ userId, channelId: channel.id }),
    };
  }

  async feed(userId: string, page: number, limit: number) {
    const follows = await this.follows.find({
      where: { userId },
      relations: { channel: true },
    });
    const aliases = [
      ...new Set(follows.flatMap(({ channel }) => channel.aliases)),
    ];
    if (!aliases.length)
      return {
        posts: [],
        total: 0,
        page: Math.max(1, page),
        limit: Math.min(100, Math.max(1, limit)),
      };
    return this.forum.findChannelPosts(aliases, page, limit);
  }
}
