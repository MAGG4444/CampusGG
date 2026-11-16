import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ForumPost } from './forum-post.entity';
import { ForumChannel } from './forum-channel.entity';

export type RankSort = 'new' | 'hot' | 'top';
const WINDOWS: Record<string, string | null> = {
  today: '1 day',
  week: '7 days',
  month: '30 days',
  all: null,
};

@Injectable()
export class ForumRankingService {
  constructor(
    @InjectRepository(ForumPost) private readonly posts: Repository<ForumPost>,
    @InjectRepository(ForumChannel)
    private readonly channels: Repository<ForumChannel>,
  ) {}

  async channel(
    slug: string,
    sort: string,
    window: string,
    page: number,
    limit: number,
  ) {
    const channel = await this.channels.findOneBy({ slug: slug.toLowerCase() });
    if (!channel) throw new NotFoundException('Forum channel not found');
    return this.rank({ sort, window, page, limit, aliases: channel.aliases });
  }

  async rank(options: {
    sort: string;
    window: string;
    page: number;
    limit: number;
    userId?: string;
    aliases?: string[];
    recognized?: boolean;
    personalized?: boolean;
    publicFeed?: boolean;
    search?: string;
  }) {
    const { sort, window, page, limit } = options;
    if (
      !(
        options.publicFeed ? ['new', 'liked', 'replies'] : ['new', 'hot', 'top']
      ).includes(sort) ||
      !Object.hasOwn(WINDOWS, window)
    )
      throw new BadRequestException('Invalid feed sort or time window');
    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      (page - 1) * limit > 2147483647
    )
      throw new BadRequestException('Invalid pagination');
    const schema = this.posts.manager.connection.driver.escape(
      (this.posts.manager.connection.options as { schema?: string }).schema ||
        'public',
    );
    const p = `${schema}."forum_posts"`,
      c = `${schema}."forum_channels"`,
      f = `${schema}."forum_channel_follows"`,
      l = `${schema}."forum_post_likes"`,
      m = `${schema}."forum_comments"`,
      u = `${schema}."users"`;
    const where: string[] = [];
    const params: unknown[] = [];
    const param = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };
    if (options.search) {
      if (options.search.length > 200)
        throw new BadRequestException('Search is too long');
      const search = param(options.search.trim().toLowerCase());
      where.push(
        `POSITION(${search} IN LOWER(CONCAT_WS(' ', p.title, p.content, p.game, a.username, a."display_name"))) > 0`,
      );
    }
    if (options.aliases)
      where.push(
        `LOWER(TRIM(p.game)) = ANY(${param(options.aliases)}::text[])`,
      );
    if (options.recognized)
      where.push(
        `EXISTS (SELECT 1 FROM ${c} ch WHERE LOWER(TRIM(p.game)) = ANY(ch.aliases))`,
      );
    if (sort === 'top' && WINDOWS[window])
      where.push(
        `p.created_at >= CURRENT_TIMESTAMP - ${param(WINDOWS[window])}::interval`,
      );
    const user = options.userId ? param(options.userId) : null;
    const follow = user
      ? `EXISTS (SELECT 1 FROM ${f} sub JOIN ${c} ch ON ch.id = sub.channel_id WHERE sub.user_id = ${user}::uuid AND LOWER(TRIM(p.game)) = ANY(ch.aliases))`
      : 'FALSE';
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const likes = 'COALESCE(likes.count, 0)';
    const replies = 'COALESCE(replies.count, 0)';
    const age =
      'EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - p.created_at)) / 86400.0';
    const engagement = `(${likes} + 2 * ${replies})`;
    const score = options.personalized
      ? `LN(1 + LEAST(${likes}, 20) * 0.05 + LEAST(${replies}, 10) * 0.1 + CASE WHEN ${follow} THEN 1 ELSE 0 END) - (${age}) / 7.0`
      : sort === 'liked'
        ? likes
        : sort === 'replies'
          ? replies
          : sort === 'hot'
            ? `LN(1 + LEAST(${likes}, 100) + 2 * LEAST(${replies}, 100)) - (${age}) / 3.0`
            : engagement;
    const order =
      sort === 'new' && !options.personalized
        ? 'created_at DESC, id DESC'
        : 'score DESC, created_at DESC, id DESC';
    const newest = sort === 'new' && !options.personalized;
    const limitParam = param(limit);
    const offsetParam = param((page - 1) * limit);
    const candidates = newest
      ? `SELECT * FROM eligible ORDER BY created_at DESC, id DESC LIMIT ${limitParam} OFFSET ${offsetParam}`
      : 'SELECT * FROM eligible';
    const selection = newest
      ? `SELECT * FROM ranked ORDER BY ${order}`
      : `SELECT * FROM ranked ORDER BY ${order} LIMIT ${limitParam} OFFSET ${offsetParam}`;
    const sql = `WITH eligible AS (
      SELECT p.id, p.title, p.content, p.game, p.created_at, a.username, a."display_name"
      FROM ${p} p JOIN ${u} a ON a.id = p.author_id ${whereSql}
    ), candidates AS (${candidates}
    ), likes AS (
      SELECT x.post_id, COUNT(*)::int AS count FROM ${l} x JOIN candidates e ON e.id = x.post_id GROUP BY x.post_id
    ), replies AS (
      SELECT x.post_id, COUNT(*)::int AS count FROM ${m} x JOIN candidates e ON e.id = x.post_id GROUP BY x.post_id
    ), ranked AS (
      SELECT p.*, ${likes} AS "likeCount", ${replies} AS "replyCount", ${score} AS score
      FROM candidates p LEFT JOIN likes ON likes.post_id = p.id LEFT JOIN replies ON replies.post_id = p.id
    ), selected AS (
      ${selection}
    ) SELECT (SELECT COUNT(*)::int FROM eligible) AS total,
      COALESCE((SELECT json_agg(json_build_object('id', id, 'title', title, 'content', content, 'game', game, 'createdAt', created_at, 'author', json_build_object('username', username, 'displayName', display_name), 'likeCount', "likeCount", 'replyCount', "replyCount") ORDER BY ${order}) FROM selected), '[]'::json) AS posts`;
    const rows = await this.posts.manager.query<
      Array<{ total: number; posts: unknown[] }>
    >(sql, params);
    return { posts: rows[0].posts, total: rows[0].total, page, limit };
  }
}
