import multer from 'multer'
import sharp from 'sharp'
import User from '../models/User.js'
import { safeUser } from '../services/emailVerification.js'
import { saveProfilePhoto, removeProfilePhoto } from '../services/profilePhotoStorage.js'

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024
const types = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' }
const receive = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_BYTES, files: 1, fields: 0, parts: 1, headerPairs: 50 },
}).single('photo')

async function cleanupPrevious(reference) {
  try { await removeProfilePhoto(reference) }
  catch { console.warn('Previous profile photo could not be removed.') }
}

export async function uploadProfilePhoto(req, res) {
  try {
    if (!req.is('multipart/form-data')) throw new Error('Invalid upload')
    await new Promise((resolve, reject) => receive(req, res, error => error ? reject(error) : resolve()))
  } catch (error) {
    return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ message: error.code === 'LIMIT_FILE_SIZE' ? 'Photo must be at most 2 MB' : 'Invalid photo upload' })
  }
  if (!req.file || !types[req.file.mimetype]) return res.status(400).json({ message: 'Choose a JPEG, PNG or WebP photo' })
  let buffer
  try {
    const bytes = req.file.buffer
    const signature = bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) ? 'jpeg'
      : bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'png'
        : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP' ? 'webp' : null
    if (signature !== types[req.file.mimetype]) throw new Error('Invalid image')
    const image = sharp(req.file.buffer, { limitInputPixels: 16_000_000, failOn: 'warning' })
    const metadata = await image.metadata()
    if (metadata.format !== types[req.file.mimetype] || (metadata.pages || 1) !== 1) throw new Error('Invalid image')
    buffer = await image.rotate().resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer()
  } catch { return res.status(400).json({ message: 'Choose a valid JPEG, PNG or WebP photo' }) }
  const current = await User.findById(req.auth.userId)
  if (!current) return res.status(401).json({ message: 'Unauthorized' })
  const reference = await saveProfilePhoto(buffer)
  let user
  try {
    user = await User.findByIdAndUpdate(req.auth.userId, { $set: { profilePhoto: reference } }, { returnDocument: 'after', runValidators: true })
    if (!user) { await removeProfilePhoto(reference); return res.status(401).json({ message: 'Unauthorized' }) }
  } catch (error) { await cleanupPrevious(reference); throw error }
  await cleanupPrevious(current.profilePhoto)
  return res.json({ user: safeUser(user) })
}

export async function deleteProfilePhoto(req, res) {
  // No identity, filenames or references are accepted from the request.
  if (req.body && Object.keys(req.body).length) return res.status(400).json({ message: 'Invalid photo removal request' })
  const current = await User.findById(req.auth.userId)
  if (!current) return res.status(401).json({ message: 'Unauthorized' })
  const user = await User.findByIdAndUpdate(req.auth.userId, { $unset: { profilePhoto: '' } }, { returnDocument: 'after' })
  if (!user) return res.status(401).json({ message: 'Unauthorized' })
  await cleanupPrevious(current.profilePhoto)
  return res.json({ user: safeUser(user) })
}
