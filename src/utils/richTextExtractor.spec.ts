import { describe, expect, test } from 'vitest'

import { defaultNotificationTransformer, extractTextFromRichText, truncateText } from './richTextExtractor'

describe('extractTextFromRichText', () => {
  test('returns empty string for falsy input', () => {
    expect(extractTextFromRichText(null)).toBe('')
    expect(extractTextFromRichText(undefined)).toBe('')
  })

  test('returns the string itself when given a plain string', () => {
    expect(extractTextFromRichText('hello')).toBe('hello')
  })

  test('extracts text from a Slate-style array', () => {
    const slate = [
      { type: 'p', children: [{ text: 'Hello ' }, { text: 'world', bold: true }] },
    ]
    expect(extractTextFromRichText(slate)).toBe('Hello world')
  })

  test('extracts text from Lexical {root} wrapper', () => {
    const lexical = {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'text', text: 'Hello' }],
          },
        ],
      },
    }
    expect(extractTextFromRichText(lexical)).toBe('Hello')
  })

  test('extracts text from multiple Lexical blocks', () => {
    const lexical = {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'text', text: 'First paragraph' }],
          },
          {
            type: 'heading',
            children: [{ type: 'text', text: 'Second heading' }],
          },
        ],
      },
    }
    expect(extractTextFromRichText(lexical)).toBe('First paragraph Second heading')
  })

  test('returns empty string for unrecognized objects', () => {
    expect(extractTextFromRichText({ foo: 'bar' })).toBe('')
  })
})

describe('defaultNotificationTransformer', () => {
  test('extracts Lexical message body into push body', () => {
    const notification = {
      id: '1',
      title: 'Test',
      message: {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Hello from Lexical' }],
            },
          ],
        },
      },
      createdAt: new Date().toISOString(),
    }
    const result = defaultNotificationTransformer(notification)
    expect(result.body).toBe('Hello from Lexical')
  })

  test('falls back when message is empty Lexical', () => {
    const notification = {
      id: '1',
      title: 'Test',
      message: { root: { type: 'root', children: [] } },
      createdAt: new Date().toISOString(),
    }
    const result = defaultNotificationTransformer(notification)
    expect(result.body).toBe('You have a new notification')
  })
})

describe('truncateText', () => {
  test('truncates long text with ellipsis', () => {
    expect(truncateText('a'.repeat(200), 100)).toBe('a'.repeat(97) + '...')
  })

  test('returns short text unchanged', () => {
    expect(truncateText('short', 100)).toBe('short')
  })
})
