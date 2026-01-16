import { UsersController } from '../../../src/controllers/users-controller'

const mockGetAll = jest.fn()
jest.mock('../../../src/models/users-model', () => ({
  UsersModel: jest.fn().mockImplementation(() => ({
    getAll: mockGetAll
  }))
}))

describe('UsersController', () => {
  let usersController
  let req
  let res

  beforeEach(() => {
    usersController = new UsersController()
    req = {}
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() }
  })

  it('should get all users', async () => {
    const mockUsers = [{ id: 1, name: 'John Doe' }]
    mockGetAll.mockResolvedValue(mockUsers)

    await usersController.getAll(req, res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(mockUsers)
  })
})
