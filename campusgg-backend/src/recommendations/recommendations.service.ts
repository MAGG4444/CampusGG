import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { canonicalGameName, findGamingProfile } from '../common/games.config';
import { LobbiesService } from '../lobbies/lobbies.service';
import { LobbyVisibility } from '../lobbies/lobby.entity';
import { UsersService } from '../users/users.service';
import { LobbyRecommendationsQueryDto } from './dto/lobby-recommendations-query.dto';
import { QuickJoinDto } from './dto/quick-join.dto';
import { SuggestedUsersQueryDto } from './dto/suggested-users-query.dto';
import { rankLobbyRecommendations, type LobbyCandidate } from './lobby-scorer';
import {
  LOBBY_RECOMMENDATION_LIMIT,
  SUGGESTED_USER_LIMIT,
} from './recommendation.config';
import {
  campusDomainFromEmail,
  uniqueRoles,
  type FitLabel,
} from './scoring.utils';
import { rankSuggestedUsers, type SuggestedUserCandidate } from './user-scorer';

export interface PublicLobbyDto {
  id: string;
  lobbyName: string;
  subtitle: string | null;
  details: string;
  tags: string[];
  game: string | null;
  skillLevel: string | null;
  neededRoles: string[];
  participantLimit: number | null;
  visibility: LobbyVisibility;
  createdAt: Date;
  updatedAt: Date;
  memberCount: number;
  host: { id: string; username: string };
}

export interface LobbyRecommendationItemDto {
  lobby: PublicLobbyDto;
  score: number;
  fit: FitLabel;
  reasons: string[];
  exploration: boolean;
}

export interface LobbyRecommendationsResponse {
  items: LobbyRecommendationItemDto[];
  currentLobbyId?: string;
}

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly lobbiesService: LobbiesService,
    private readonly usersService: UsersService,
  ) {}

  async recommendLobbies(
    userId: string,
    query: LobbyRecommendationsQueryDto = {},
  ): Promise<LobbyRecommendationsResponse> {
    const viewer = await this.usersService.findOne(userId);
    const currentLobbyId = await this.lobbiesService.findCurrentLobbyId(userId);
    if (currentLobbyId) {
      return { items: [], currentLobbyId };
    }

    const game =
      query.game?.trim() || viewer.gamingProfiles?.[0]?.game || undefined;
    // Cross-game browsing without a profile produces neutral, reasonless
    // scores. Suppress it instead of showing a weak "possible" card.
    if (!game || !findGamingProfile(viewer.gamingProfiles, game)) {
      return { items: [] };
    }

    const candidates = await this.lobbiesService.findRecommendationCandidates(
      userId,
      game,
    );
    const items = rankLobbyRecommendations(candidates, viewer, {
      limit: query.limit ?? LOBBY_RECOMMENDATION_LIMIT,
    });

    return {
      items: items.map((item) => ({
        lobby: this.publicLobby(item.lobby),
        score: item.score,
        fit: item.fit,
        reasons: item.reasons,
        exploration: item.exploration,
      })),
    };
  }

  async recommendUsers(userId: string, query: SuggestedUsersQueryDto = {}) {
    const viewer = await this.usersService.findOne(userId);
    const profiles = viewer.gamingProfiles ?? [];
    if (profiles.length === 0) {
      return { items: [], needsProfile: true, game: null };
    }

    const game = query.game?.trim() || profiles[0].game;
    if (!findGamingProfile(profiles, game)) {
      return {
        items: [],
        needsProfile: true,
        game: canonicalGameName(game),
      };
    }

    const candidates: SuggestedUserCandidate[] =
      await this.usersService.findRecommendationCandidates(userId, game);
    const items = rankSuggestedUsers(candidates, viewer, game, {
      limit: query.limit ?? SUGGESTED_USER_LIMIT,
    });

    return {
      needsProfile: false,
      game: canonicalGameName(game),
      items: items.map((item) => {
        const profile =
          item.profile ??
          findGamingProfile(item.user.gamingProfiles, game) ??
          null;
        return {
          user: {
            id: item.user.id,
            username: item.user.username,
            displayName: item.user.displayName || item.user.username,
            bio: item.user.bio ?? '',
            campusDomain: campusDomainFromEmail(item.user.email),
            game: profile?.game ?? canonicalGameName(game),
            experienceLevel: profile?.experienceLevel ?? null,
            preferredRoles: profile ? [...profile.preferredRoles] : [],
          },
          score: item.score,
          fit: item.fit,
          reasons: item.reasons,
        };
      }),
    };
  }

  /**
   * Always terminates in a lobby or a create-lobby fallback. There is no
   * queue, timer, or polling state.
   */
  async quickJoin(userId: string, dto: QuickJoinDto = {}) {
    const viewer = await this.usersService.findOne(userId);
    const existingLobbyId =
      await this.lobbiesService.findCurrentLobbyId(userId);
    if (existingLobbyId) {
      return {
        lobbyId: existingLobbyId,
        joined: true,
        alreadyMember: true,
        reasons: [],
      };
    }

    const game =
      dto.game?.trim() || viewer.gamingProfiles?.[0]?.game || undefined;
    const recommendations = await this.recommendLobbies(userId, {
      game,
      limit: LOBBY_RECOMMENDATION_LIMIT,
    });

    for (const item of recommendations.items) {
      try {
        await this.lobbiesService.joinLobby(item.lobby.id, userId);
        return {
          lobbyId: item.lobby.id,
          joined: true,
          alreadyMember: false,
          reasons: item.reasons,
        };
      } catch (error) {
        if (
          error instanceof ConflictException ||
          error instanceof NotFoundException ||
          error instanceof ForbiddenException
        ) {
          continue;
        }
        throw error;
      }
    }

    // A concurrent request may have placed the user in a lobby after the
    // initial check. Return that lobby instead of sending them to create one.
    const joinedLobbyId = await this.lobbiesService.findCurrentLobbyId(userId);
    if (joinedLobbyId) {
      return {
        lobbyId: joinedLobbyId,
        joined: true,
        alreadyMember: true,
        reasons: [],
      };
    }

    const neededRoles = uniqueRoles(
      recommendations.items.flatMap((item) => item.lobby.neededRoles ?? []),
    ).slice(0, 5);
    return {
      fallback: 'create-lobby' as const,
      prefill: {
        game: game ? canonicalGameName(game) : null,
        neededRoles,
      },
    };
  }

  /** Public lobby shape; the host's email never leaves the server. */
  private publicLobby(lobby: LobbyCandidate): PublicLobbyDto {
    return {
      id: lobby.id,
      lobbyName: lobby.lobbyName,
      subtitle: lobby.subtitle,
      details: lobby.details,
      tags: lobby.tags,
      game: lobby.game,
      skillLevel: lobby.skillLevel,
      neededRoles: lobby.neededRoles ?? [],
      participantLimit: lobby.participantLimit,
      visibility: lobby.visibility,
      createdAt: lobby.createdAt,
      updatedAt: lobby.updatedAt,
      memberCount: lobby.memberCount,
      host: {
        id: lobby.host.id,
        username: lobby.host.username,
      },
    };
  }
}
