import type { UserProfile, Match, WithId } from './types';
import { collection, getDocs, getDoc, doc, setDoc, updateDoc, addDoc, WriteBatch, writeBatch, Firestore, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase/server';

// This function should be the single entry point for getting a Firestore instance.
export function getFirestoreInstance() {
    return db;
}

export const seedInitialData = async (db: Firestore) => {
    // Seeding logic is disabled as users are now created through registration.
    console.log("Seeding is disabled.");
}


export const getPlayers = async (): Promise<WithId<UserProfile>[]> => {
    const db = getFirestoreInstance();
    const playersCol = collection(db, 'users');
    const playerSnapshot = await getDocs(playersCol);
    const playerList = playerSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as WithId<UserProfile>));
    return playerList;
};

export const getPlayerById = async (id: string): Promise<WithId<UserProfile> | undefined> => {
    const db = getFirestoreInstance();
    const playerRef = doc(db, 'users', id);
    const playerSnap = await getDoc(playerRef);
    if (playerSnap.exists()) {
        return { ...playerSnap.data(), id: playerSnap.id } as WithId<UserProfile>;
    }
    return undefined;
};

export const getMatches = async (): Promise<WithId<Match>[]> => {
    const db = getFirestoreInstance();
    const matchesCol = collection(db, 'matches');
    const matchSnapshot = await getDocs(matchesCol);
    const matchList = matchSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as WithId<Match>));
    return matchList;
};

export const getMatchesByPlayerId = async (playerId: string): Promise<WithId<Match>[]> => {
    const allMatches = await getMatches();
    return allMatches.filter(m => m.team_1.includes(playerId) || m.team_2.includes(playerId));
};

export const updatePlayer = async (updatedPlayer: WithId<UserProfile>): Promise<void> => {
    const db = getFirestoreInstance();
    const playerRef = doc(db, 'users', updatedPlayer.id);
    const { id, ...playerData } = updatedPlayer;
    await updateDoc(playerRef, playerData);
};

export const addMatch = async (newMatch: Match): Promise<void> => {
    const db = getFirestoreInstance();
    await addDoc(collection(db, 'matches'), newMatch);
};
