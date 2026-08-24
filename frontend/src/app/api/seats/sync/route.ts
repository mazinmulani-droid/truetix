import { NextResponse } from 'next/server';

// Server memory shared across all tabs, windows, incognito sessions, and devices
const globalLockStore: Record<
  string,
  Record<string, { status: 'HOLDING' | 'SOLD'; heldBy: string; expiresAt: number }>
> = {
  st_demo_1: {
    C4: { status: 'SOLD', heldBy: 'system', expiresAt: Infinity },
    C5: { status: 'SOLD', heldBy: 'system', expiresAt: Infinity },
    F7: { status: 'SOLD', heldBy: 'system', expiresAt: Infinity },
  },
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const showtimeId = searchParams.get('showtimeId') || 'st_demo_1';

  const now = Date.now();
  if (!globalLockStore[showtimeId]) {
    globalLockStore[showtimeId] = {
      C4: { status: 'SOLD', heldBy: 'system', expiresAt: Infinity },
      C5: { status: 'SOLD', heldBy: 'system', expiresAt: Infinity },
      F7: { status: 'SOLD', heldBy: 'system', expiresAt: Infinity },
    };
  }

  const locks = globalLockStore[showtimeId];

  // Cleanup expired 10-minute temporary locks
  Object.keys(locks).forEach((seatId) => {
    if (locks[seatId].status === 'HOLDING' && locks[seatId].expiresAt < now) {
      delete locks[seatId];
    }
  });

  return NextResponse.json({
    success: true,
    data: locks,
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  const {
    showtimeId = 'st_demo_1',
    seatIds = [],
    action = 'LOCK',
    senderId = 'anonymous',
  } = body;

  if (!globalLockStore[showtimeId]) {
    globalLockStore[showtimeId] = {
      C4: { status: 'SOLD', heldBy: 'system', expiresAt: Infinity },
      C5: { status: 'SOLD', heldBy: 'system', expiresAt: Infinity },
      F7: { status: 'SOLD', heldBy: 'system', expiresAt: Infinity },
    };
  }

  const locks = globalLockStore[showtimeId];
  const now = Date.now();
  const ttl = 10 * 60 * 1000; // 10 minutes

  if (action === 'LOCK') {
    // Check if any seat is already sold or held by someone else
    for (const seatId of seatIds) {
      if (locks[seatId] && locks[seatId].status === 'SOLD') {
        return NextResponse.json(
          { success: false, code: 'ALREADY_SOLD', seatId },
          { status: 409 }
        );
      }
      if (
        locks[seatId] &&
        locks[seatId].status === 'HOLDING' &&
        locks[seatId].expiresAt > now &&
        locks[seatId].heldBy !== senderId
      ) {
        return NextResponse.json(
          { success: false, code: 'ALREADY_HELD', seatId },
          { status: 409 }
        );
      }
    }

    // Acquire lock
    seatIds.forEach((seatId: string) => {
      locks[seatId] = {
        status: 'HOLDING',
        heldBy: senderId,
        expiresAt: now + ttl,
      };
    });
  } else if (action === 'RELEASE') {
    seatIds.forEach((seatId: string) => {
      if (locks[seatId] && locks[seatId].heldBy === senderId) {
        delete locks[seatId];
      }
    });
  } else if (action === 'BOOK') {
    seatIds.forEach((seatId: string) => {
      locks[seatId] = {
        status: 'SOLD',
        heldBy: senderId,
        expiresAt: Infinity,
      };
    });
  }

  return NextResponse.json({
    success: true,
    data: locks,
  });
}
