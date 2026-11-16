import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ForumChannel } from './forum-channel.entity';
import { ForumChannelFollow } from './forum-channel-follow.entity';
import { ForumService } from './forum.service';

// Maintained genres keyed by persistent channel ID; unknown channels remain uncategorized.
const CHANNEL_CATEGORIES: Readonly<Record<string, string>> = {
  valorant: 'FPS',
  'counter-strike-2': 'FPS',
  'overwatch-2': 'FPS',
  'league-of-legends': 'MOBA',
  dota: 'MOBA',
  minecraft: 'Sandbox',
  'rocket-league': 'Sports',
  'it-takes-two': 'Co-op',
};

@Injectable()
export class ForumChannelsService {
  constructor(
    @InjectRepository(ForumChannel)
    private readonly channels: Repository<ForumChannel>,
    private readonly forum: ForumService,
    @InjectRepository(ForumChannelFollow)
    private readonly follows: Repository<ForumChannelFollow>,
  ) {}

  async list() {
    const channels = await this.channels.find({
      order: { name: 'ASC', id: 'ASC' },
    });
    const counts = await this.follows
      .createQueryBuilder('follow')
      .select('follow.channelId', 'channelId')
      .addSelect('COUNT(*)', 'count')
      .groupBy('follow.channelId')
      .getRawMany<{ channelId: string; count: string }>();
    const byChannel = new Map(
      counts.map((row) => [row.channelId, Number(row.count)]),
    );
    return channels.map(({ id, slug, name, aliases }) => ({
      id,
      slug,
      name,
      aliases,
      category: CHANNEL_CATEGORIES[id] ?? null,
      followerCount: byChannel.get(id) ?? 0,
    }));
  }

  private async resolve(slug: string) {
    const channel = await this.channels.findOneBy({ slug: slug.toLowerCase() });
    if (!channel) throw new NotFoundException('Forum channel not found');
    return channel;
  }

  async get(slug: string) {
    const { id, name, slug: canonicalSlug } = await this.resolve(slug);
    return { id, name, slug: canonicalSlug };
  }

  async posts(slug: string, page: number, limit: number) {
    const channel = await this.resolve(slug);
    return this.forum.findChannelPosts(channel.aliases, page, limit);
  }
}
