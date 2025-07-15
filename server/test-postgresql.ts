import { dbStorage } from "./database";

async function testPostgreSQL() {
  console.log('Testing PostgreSQL database connection...');
  
  try {
    console.log('Testing getPlayerByEmail...');
    const player = await dbStorage.getPlayerByEmail('vigneshthc@gmail.com');
    console.log('PostgreSQL player result:', player);
    
    console.log('Testing getPlayer by ID...');
    const playerById = await dbStorage.getPlayer(22);
    console.log('PostgreSQL player by ID result:', playerById);
    
  } catch (error) {
    console.error('PostgreSQL test error:', error);
  }
}

testPostgreSQL();