import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const leads=sqliteTable('leads',{
 id:text('id').primaryKey(),createdAt:text('created_at').notNull(),payload:text('payload').notNull(),payloadHash:text('payload_hash').notNull(),
 score:integer('score').notNull(),premium:integer('premium').notNull(),priority:text('priority').notNull(),reasons:text('reasons').notNull(),
 sheetStatus:text('sheet_status').notNull().default('pending'),sheetError:text('sheet_error'),status:text('status').notNull().default('New')
});
export const rateLimits=sqliteTable('rate_limits',{key:text('key').primaryKey(),hits:integer('hits').notNull(),expiresAt:integer('expires_at').notNull()});

export const confirmationEmails=sqliteTable('confirmation_emails',{
 leadId:text('lead_id').primaryKey(),status:text('status').notNull(),payload:text('payload').notNull(),attempts:integer('attempts').notNull().default(0),firstAttemptAt:integer('first_attempt_at'),lastAttemptAt:integer('last_attempt_at'),providerId:text('provider_id'),acceptedAt:text('accepted_at'),error:text('error')
});
