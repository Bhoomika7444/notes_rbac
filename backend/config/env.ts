import dotenv from 'dotenv';
import path from 'path';

const envFiles = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../.env'),
];

for (const envFile of envFiles) {
  dotenv.config({
    path: envFile,
    override: false,
  });
}
