import { main } from './app/main'
import { config } from 'dotenv'
config()

main().then(() => console.log('Servidor finalizado')).catch(err => console.error(err))
