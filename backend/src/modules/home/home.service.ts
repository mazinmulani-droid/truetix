import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MovieStatus } from '@prisma/client';

@Injectable()
export class HomeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Homepage data aggregator: returns active movies, cities, and cinemas
   */
  async getHomePageData(cityId?: string) {
    const [nowShowingMovies, comingSoonMovies, cities, featuredCinemas] = await Promise.all([
      // Movies currently playing
      this.prisma.movie.findMany({
        where: { status: MovieStatus.NOW_SHOWING },
        orderBy: { releaseDate: 'desc' },
        take: 10,
      }),
      // Upcoming movies
      this.prisma.movie.findMany({
        where: { status: MovieStatus.COMING_SOON },
        orderBy: { releaseDate: 'asc' },
        take: 10,
      }),
      // Available cities
      this.prisma.city.findMany({
        orderBy: { displayOrder: 'asc' },
        include: {
          _count: { select: { cinemas: true } },
        },
      }),
      // Featured cinemas filtered optionally by city
      this.prisma.cinema.findMany({
        where: {
          ...(cityId && { cityId }),
        },
        include: {
          city: true,
          halls: { select: { id: true, name: true, screenType: true } },
        },
        take: 12,
      }),
    ]);

    return {
      banners: [],
      movies: {
        nowShowing: nowShowingMovies,
        comingSoon: comingSoonMovies,
      },
      cities: cities.map((c) => ({
        id: c.id,
        name: c.name,
        code: c.code,
        cinemaCount: c._count.cinemas,
      })),
      featuredCinemas,
    };
  }
}
