import { UsersModel } from '../../../src/models/users-model'
import { db } from '../../../src/db/config'

// Mock the db module
jest.mock('../../../src/db/config', () => ({
  db: {
    query: jest.fn() // Mock the query method
  }
}))

describe('UsersModel', () => {
  let usersModel: UsersModel

  beforeEach(() => {
    usersModel = new UsersModel()
  })

  it('should get all users', async () => {
    const mockUsers = [{ id: 1, name: 'John Doe' }];

    // Cast db.query as a Jest mock
    (db.query as jest.Mock).mockResolvedValue([mockUsers])

    const users = await usersModel.getAll()

    expect(db.query).toHaveBeenCalledWith('SELECT * FROM users')
    expect(users).toEqual(mockUsers)
  })
})
