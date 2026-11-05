import { PrismaClient, Role, MovieStatus, AgeRating, ScreenType, SeatType, SeatStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run seed script in production environment!');
  }

  console.log('⚠️ Running TrueTix development database seeder (resets demo data)...');
  console.log('🧹 Cleaning existing database data...');

  // Delete in correct order to respect foreign key constraints
  await prisma.ticket.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.showtimeSeat.deleteMany();
  await prisma.showtime.deleteMany();
  await prisma.movie.deleteMany();
  await prisma.hall.deleteMany();
  await prisma.cinema.deleteMany();
  await prisma.city.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  console.log('🌱 Seeding demo users...');
  const passwordHash = await bcrypt.hash('Password123!', 10);

  const admin = await prisma.user.create({
    data: {
      id: 'usr_admin_01',
      email: 'admin@truetix.com',
      password: passwordHash,
      fullName: 'TrueTix System Admin',
      phone: '+91 9876543210',
      role: Role.ADMIN,
    },
  });

  const alice = await prisma.user.create({
    data: {
      id: 'usr_alice_01',
      email: 'alice@truetix.com',
      password: passwordHash,
      fullName: 'Alice Johnson',
      phone: '+91 9876543211',
      role: Role.CUSTOMER,
    },
  });

  const bob = await prisma.user.create({
    data: {
      id: 'usr_bob_02',
      email: 'bob@truetix.com',
      password: passwordHash,
      fullName: 'Bob Smith',
      phone: '+91 9876543212',
      role: Role.CUSTOMER,
    },
  });

  console.log('🌱 Seeding cinema and hall layout...');
  const city = await prisma.city.create({
    data: {
      id: 'city_01',
      name: 'Mumbai',
      code: 'BOM',
      displayOrder: 1,
    },
  });

  const cinema = await prisma.cinema.create({
    data: {
      id: 'cin_01',
      cityId: city.id,
      name: 'TrueTix Phoenix Mall Cinema',
      address: 'Phoenix Palladium, Lower Parel, Mumbai',
      phone: '022-49123456',
      amenities: ['IMAX Laser', 'Dolby Atmos', 'VIP Recliners', 'Gourmet Bar'],
    },
  });

  // Construct Hall roomMatrix: 8 rows (A-H), 10 seats per row
  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const grid: any[][] = [];
  rows.forEach((rowLetter) => {
    const rowArr: any[] = [];
    const isVip = ['D', 'E', 'F', 'G'].includes(rowLetter);
    const isCouple = rowLetter === 'H';
    const cols = isCouple ? 5 : 10;

    for (let c = 1; c <= cols; c++) {
      rowArr.push({
        id: `${rowLetter}${c}`,
        row: rowLetter,
        col: c,
        type: isCouple ? 'COUPLE' : isVip ? 'VIP' : 'STANDARD',
        priceModifier: isCouple ? 2.0 : isVip ? 1.25 : 1.0,
      });
    }
    grid.push(rowArr);
  });

  const hall = await prisma.hall.create({
    data: {
      id: 'hall_01',
      cinemaId: cinema.id,
      name: 'IMAX Laser Hall 1',
      screenType: ScreenType.IMAX,
      roomMatrix: { rows: rows.length, cols: 10, grid },
    },
  });

  console.log('🌱 Seeding movies and showtimes...');
  const movie = await prisma.movie.create({
    data: {
      id: 'mov_01',
      title: 'Avatar: The Way of Water',
      titleOriginal: 'Avatar 2',
      director: 'James Cameron',
      cast: 'Sam Worthington, Zoe Saldana, Sigourney Weaver',
      genres: ['Sci-Fi', 'Action', 'Adventure'],
      durationMinutes: 192,
      releaseDate: new Date('2022-12-16'),
      posterUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=800&auto=format&fit=crop',
      ageRating: AgeRating.T13,
      status: MovieStatus.NOW_SHOWING,
      description: 'Set more than a decade after the events of the first film, Avatar: The Way of Water begins to tell the story of the Sully family.',
    },
  });

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(19, 0, 0, 0);

  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setHours(22, 15, 0, 0);

  const showtime = await prisma.showtime.create({
    data: {
      id: 'st_demo_1',
      movieId: movie.id,
      cinemaId: cinema.id,
      hallId: hall.id,
      startTime: tomorrow,
      endTime: tomorrowEnd,
      basePrice: 300,
    },
  });

  // Create ShowtimeSeats in DB (80 seats total)
  const seatsToInsert: any[] = [];
  rows.forEach((rowLetter) => {
    const isVip = ['D', 'E', 'F', 'G'].includes(rowLetter);
    const isCouple = rowLetter === 'H';
    const cols = isCouple ? 5 : 10;

    for (let c = 1; c <= cols; c++) {
      const seatId = `${rowLetter}${c}`;
      seatsToInsert.push({
        showtimeId: showtime.id,
        seatId,
        row: rowLetter,
        col: c,
        type: isCouple ? SeatType.COUPLE : isVip ? SeatType.VIP : SeatType.STANDARD,
        status: SeatStatus.AVAILABLE,
        priceModifier: isCouple ? 2.0 : isVip ? 1.25 : 1.0,
      });
    }
  });

  await prisma.showtimeSeat.createMany({
    data: seatsToInsert,
  });

  console.log('✅ Demo seed completed successfully!');
  console.log('================================================================');
  console.log('👤 Demo User Accounts:');
  console.log('   Admin:      admin@truetix.com    / Password123!');
  console.log('   Alice:      alice@truetix.com    / Password123!');
  console.log('   Bob:        bob@truetix.com      / Password123!');
  console.log('🎬 Movie & Showtime:');
  console.log('   Showtime ID: st_demo_1 (Avatar: The Way of Water)');
  console.log('   Auditorium:  IMAX Laser Hall 1 (80 seats initialized)');
  console.log('================================================================');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
