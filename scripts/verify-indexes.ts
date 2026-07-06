import mongoose from 'mongoose'
import { config } from '../src/config'

const REQUIRED_INDEXES: Record<string, string[]> = {
  opportunities: [
    'title_text_company_text_description_text',
    'requiredSkills_1',
    'locationType_1',
    'roleLevel_1',
    'aiConfidence_-1_createdAt_-1',
    'isExpired_1_deadline_1',
    'createdAt_-1',
    'company_1_title_1',
    'pipelineStatus_1_createdAt_-1',
    'locationType_1_roleLevel_1_employmentType_1',
    'isExpired_1_locationType_1_roleLevel_1',
    'salaryMin_1_salaryMax_1',
  ],
  contributions: [
    'opportunityId_1',
    'opportunityId_1_type_1',
    'userId_1',
    'type_1_helpfulCount_-1',
  ],
  applicationworkspaces: [
    'userId_1_opportunityId_1',
    'userId_1_status_1',
    'opportunityId_1',
  ],
  matchresults: [
    'userId_1_opportunityId_1',
    'overallScore_-1',
    'opportunityId_1',
  ],
  notifications: [
    'userId_1_dismissed_1_createdAt_-1',
  ],
}

async function verify() {
  await mongoose.connect(config.mongodbUri)
  console.log('Connected to MongoDB\n')

  let allOk = true

  for (const [collection, expected] of Object.entries(REQUIRED_INDEXES)) {
    const indexes = await mongoose.connection.db.collection(collection).indexes()
    const existingNames = indexes.map(i => i.name)

    for (const name of expected) {
      if (!existingNames.includes(name)) {
        console.log(`MISSING: ${collection}.${name}`)
        allOk = false
      }
    }
  }

  if (allOk) {
    console.log('All required indexes verified OK')
  } else {
    console.log('\nSome indexes are missing. Run the app to auto-create them.')
    process.exit(1)
  }

  await mongoose.disconnect()
}

verify().catch(err => {
  console.error('Index verification failed:', err)
  process.exit(1)
})
