/**
 * @interlace/ui — games/reminder-model
 *
 * A daily reminder the player keeps in their own calendar: an iCalendar
 * (.ics) file with one event that repeats every day at a time they chose,
 * with an alert. Nothing is sent and nothing is stored on a server; the
 * player's calendar does the reminding, and they remove it there.
 *
 * Pure, so a server can serve the same file from a link.
 *
 * ## Local time
 *
 * The event uses floating time (no time zone), so "6:30 PM" stays 6:30 PM
 * wherever the player is, which is what a daily habit wants.
 *
 * ## Format
 *
 * RFC 5545: CRLF line ends, text escaped, lines folded at 75 octets.
 */

import { isDayKey, type DayKey } from './daily.js';

export interface ReminderInput {
  /** The event's title, as the calendar shows it. */
  title: string;
  /** A line or two under the title. */
  description?: string;
  /** Opens from the event. */
  url?: string;
  /** "HH:MM", 24-hour, the player's local time. */
  time: string;
  /** The first day. */
  start: DayKey;
  /** Minutes the event lasts. @default 10 */
  minutes?: number;
  /** Stable id, so adding it again updates rather than duplicates. */
  uid: string;
  /** Names the app that made the file. @default '-//Interlace//Reminder//EN' */
  prodId?: string;
  /** When the file was made, for DTSTAMP. @default now */
  now?: Date;
}

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** True for a 24-hour "HH:MM". */
export function isReminderTime(value: string): boolean {
  return TIME.test(value);
}

/** Escapes text for an iCalendar value. */
export function escapeIcsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Folds a content line at 75 octets, continuation lines starting with a space. */
export function foldIcsLine(line: string): string {
  const enc = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  let size = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    const limit = parts.length === 0 ? 75 : 74;
    if (size + n > limit) {
      parts.push(current);
      current = '';
      size = 0;
    }
    current += ch;
    size += n;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

const pad = (n: number) => String(n).padStart(2, '0');

function stampUtc(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(
    d.getUTCMinutes(),
  )}${pad(d.getUTCSeconds())}Z`;
}

/** The .ics text for a daily reminder. Throws on a bad time or day key. */
export function reminderIcs(input: ReminderInput): string {
  const match = TIME.exec(input.time);
  if (!match) throw new RangeError(`reminderIcs: time must be "HH:MM", got "${input.time}"`);
  if (!isDayKey(input.start)) throw new RangeError(`reminderIcs: start must be a day key, got "${input.start}"`);
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const length = Math.max(1, Math.min(120, Math.floor(input.minutes ?? 10)));
  const date = input.start.replace(/-/g, '');
  const endMinutes = hour * 60 + minute + length;
  // An event that would end after midnight ends at 23:59 instead.
  const end = endMinutes >= 24 * 60 ? '235900' : `${pad(Math.floor(endMinutes / 60))}${pad(endMinutes % 60)}00`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${input.prodId ?? '-//Interlace//Reminder//EN'}`,
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${input.uid}`,
    `DTSTAMP:${stampUtc(input.now ?? new Date())}`,
    `DTSTART:${date}T${pad(hour)}${pad(minute)}00`,
    `DTEND:${date}T${end}`,
    'RRULE:FREQ=DAILY',
    `SUMMARY:${escapeIcsText(input.title)}`,
  ];
  if (input.description) lines.push(`DESCRIPTION:${escapeIcsText(input.description)}`);
  if (input.url) lines.push(`URL:${input.url}`);
  lines.push(
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcsText(input.title)}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  );
  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}
