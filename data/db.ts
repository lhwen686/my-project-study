import type { SQLiteDatabase } from 'expo-sqlite';

export const DB_NAME = 'review-app.db';

/**
 * 同步初始化数据库，作为 <SQLiteProvider onInit> 的回调。
 * 使用 execSync 确保表在组件树渲染前就绪。
 */
export function initDB(db: SQLiteDatabase): void {
  db.execSync('PRAGMA journal_mode = WAL;');
  db.execSync('PRAGMA foreign_keys = ON;');

  db.execSync(`
    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      front_content TEXT NOT NULL,
      back_content TEXT NOT NULL,
      next_review_date INTEGER NOT NULL,
      interval INTEGER DEFAULT 0,
      ease_factor REAL DEFAULT 2.5,
      reps INTEGER DEFAULT 0
    );
  `);
}
