import { storage, STORAGE_KEYS } from './storage';

export const isUserAdmin = (user: any): boolean => {
  if (!user) return false;
  return (
    user.role === 'SUPER_ADMIN' ||
    user.role === 'HOSPITAL_ADMIN' ||
    user.role === 'ADMIN' ||
    user.role?.toUpperCase().includes('ADMIN') ||
    (user.email && user.email.toLowerCase().includes('admin')) ||
    (user.name && user.name.toLowerCase().includes('admin'))
  );
};

export const canUserModify = (currentUser: any, record: any, allUsers?: any[]): boolean => {
  // If current user is Admin, they can edit or delete anything.
  if (isUserAdmin(currentUser)) return true;

  if (!record) return true; // Safe fallback

  // Check if it's a seed/system ID
  const seedIds = [
    'p1', 'p2', 'p3', 'p4', 'p5',
    'bill1', 'bill2', 'bill3', 'bill4', 'bill5',
    'med1', 'med2', 'med3', 'med4', 'med5',
    'task1', 'task2', 'task3', 'task4',
    'delivery1', 'delivery2',
    'ot1', 'ot2'
  ];
  if (record.id && seedIds.includes(String(record.id).toLowerCase())) {
    return false; // System seed data is admin-level
  }

  // Resolve creator ID
  const creatorId = record.created_by || record.issued_by || record.createdBy || record.creator_id || record.user_id || record.userId;
  
  // If no creator ID exists, we treat it as admin-seeded fail-safe
  if (!creatorId) {
    return false;
  }

  // Explicit admin identifiers
  if (
    creatorId === 'u2' || 
    creatorId === 'u-admin' || 
    creatorId === 'u-admingh' || 
    creatorId === 'admingh' || 
    String(creatorId).toLowerCase().includes('admin')
  ) {
    return false; // Admin-filled
  }

  // Check the roles of the staff who filled it
  const users = allUsers || storage.get(STORAGE_KEYS.USERS, []);
  const creatorUser = users.find((u: any) => u.id === creatorId || u.email === creatorId || u.username === creatorId);
  if (creatorUser && isUserAdmin(creatorUser)) {
    return false; // Explicitly created by an admin
  }

  // If the record belongs to the current user (e.g. self-assigned), they can edit/delete
  if (currentUser?.id && String(creatorId) === String(currentUser.id)) {
    return true;
  }
  if (currentUser?.email && String(creatorId).toLowerCase() === String(currentUser.email).toLowerCase()) {
    return true;
  }

  // Non-admin can edit non-admin data, but cannot touch ADMIN entries.
  return true;
};
