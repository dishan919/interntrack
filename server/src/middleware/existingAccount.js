import User from '../models/User.js'
import { withAccountOperation } from '../services/accountOperations.js'

// Check inside the account queue, including requests that waited for deletion.
export default function existingAccount(handler) {
  return (req, res) => withAccountOperation(req.auth.userId, async () => {
    if (!await User.exists({ _id: req.auth.userId })) return res.status(401).json({ message: 'Unauthorized' })
    return handler(req, res)
  })
}
