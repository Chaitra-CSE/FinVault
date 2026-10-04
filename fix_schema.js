const fs = require('fs');
let content = fs.readFileSync('backend/prisma/schema.prisma', 'utf8');
content = content.replace(/id\s+String\s+@id\s+@default\(cuid\(\)\)/g, 'id String @id @default(auto()) @map("_id") @db.ObjectId');

const fields = [
  'userId', 'parentId', 'ownerId', 'folderId', 'currentVersionId',
  'documentId', 'uploadedById', 'grantedById', 'templateId',
  'startedById', 'workflowId', 'assigneeId', 'stepId', 'actorId'
];

for (const field of fields) {
  const regex = new RegExp(field + '\\s+String(\\??)', 'g');
  content = content.replace(regex, field + ' String$1 @db.ObjectId');
}

// targetId is a special case (could be anything) but since it's referring to documents etc, maybe ObjectId too.
content = content.replace(/targetId\s+String/g, 'targetId String @db.ObjectId');

// For relation actions
content = content.replace(/@relation\("FolderTree", fields: \[parentId\], references: \[id\]\)/g, '@relation("FolderTree", fields: [parentId], references: [id], onDelete: NoAction, onUpdate: NoAction)');
content = content.replace(/@relation\(fields: \[folderId\], references: \[id\]\)/g, '@relation(fields: [folderId], references: [id], onDelete: NoAction, onUpdate: NoAction)');
content = content.replace(/@relation\("CurrentVersion", fields: \[currentVersionId\], references: \[id\]\)/g, '@relation("CurrentVersion", fields: [currentVersionId], references: [id], onDelete: NoAction, onUpdate: NoAction)');
content = content.replace(/@relation\("DocVersions", fields: \[documentId\], references: \[id\], onDelete: Cascade\)/g, '@relation("DocVersions", fields: [documentId], references: [id], onDelete: NoAction, onUpdate: NoAction)');

// the rest of the Cascade ones
content = content.replace(/onDelete: Cascade/g, 'onDelete: NoAction, onUpdate: NoAction');

fs.writeFileSync('backend/prisma/schema.prisma', content);
console.log('Done');
