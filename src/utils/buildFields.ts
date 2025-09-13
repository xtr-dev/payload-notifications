import type { Field } from 'payload'
import type { NotificationRelationship } from '../types'

/**
 * Builds relationship fields dynamically based on plugin configuration
 * Creates individual relationship fields within an attachments group
 */
export function buildRelationshipFields(relationships: NotificationRelationship[]): Field[] {
  if (!relationships || relationships.length === 0) {
    return []
  }

  // Create individual relationship fields
  const relationshipFields: Field[] = relationships.map((rel) => {
    const baseField = {
      name: rel.name,
      type: 'relationship' as const,
      relationTo: rel.relationTo,
      label: rel.label || `Related ${rel.relationTo}`,
      required: rel.required || false,
    }

    // Add hasMany conditionally to satisfy the type constraints
    if (rel.hasMany) {
      return {
        ...baseField,
        hasMany: true,
      }
    }

    return baseField
  })

  // Wrap relationship fields in a group called "attachments"
  return [
    {
      name: 'attachments',
      type: 'group',
      label: 'Attachments',
      fields: relationshipFields,
    },
  ]
}