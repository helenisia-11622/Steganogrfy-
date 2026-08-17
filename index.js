import fs from 'fs';
import crypto from 'crypto';
import Jimp from 'jimp';


const blue = '\x1b[34m';
const reset = '\x1b[0m';
const red = '\x1b[31m';
const ascii1 = `
┌────────────────────────────────────┐
│┏━┓╺┳╸┏━╸┏━╸┏━┓┏┓╻┏━┓┏━╸┏━┓┏━┓┏━╸╻ ╻│
│┗━┓ ┃ ┣╸ ┃╺┓┣━┫┃┗┫┃ ┃┃╺┓┣┳┛┣━┫┣╸ ┗┳┛│
│┗━┛ ╹ ┗━╸┗━┛╹ ╹╹ ╹┗━┛┗━┛╹┗╸╹ ╹╹   ╹ │
└────────────────────────────────────┘
pembuat: Helenic
`;
const ascii2 = `
┌────────────────────────────────────┐
│┏━╸┏┳┓┏┓ ┏━╸╺┳┓   ┏━┓┏━┓┏━┓┏━┓┏━╸┏━┓│
│┣╸ ┃┃┃┣┻┓┣╸  ┃┃   ┣━┛┣┳┛┃ ┃┗━┓┣╸ ┗━┓│
│┗━╸╹ ╹┗━┛┗━╸╺┻┛   ╹  ╹┗╸┗━┛┗━┛┗━╸┗━┛│
└────────────────────────────────────┘
`;
const ascii3 = `
┌──────────────────────────────────────────┐
│┏━╸╻ ╻╺┳╸┏━┓┏━┓┏━╸╺┳╸   ┏━┓┏━┓┏━┓┏━┓┏━╸┏━┓│
│┣╸ ┏╋┛ ┃ ┣┳┛┣━┫┃   ┃    ┣━┛┣┳┛┃ ┃┗━┓┣╸ ┗━┓│
│┗━╸╹ ╹ ╹ ╹┗╸╹ ╹┗━╸ ╹    ╹  ╹┗╸┗━┛┗━┛┗━╸┗━┛│
└──────────────────────────────────────────┘
`; //yah sial cuma typo
function deriveKey(password, salt) {
  return crypto.scryptSync(password, salt, 32);
}

function encrypt(data, password) {
  const salt = crypto.randomBytes(16);
  const key = deriveKey(password, salt);
  const dataBuffer = Buffer.from(data, 'utf8');
  const enkrip = Buffer.alloc(dataBuffer.length);
  for (let i = 0; i < dataBuffer.length; i++) {
    enkrip[i] = dataBuffer[i] ^ key[i % key.length];
  }
  const kombinasi = Buffer.concat([salt, enkrip]);
  return kombinasi.toString('base64');
}

function decrypt(kombinasiBase64, password) {
  const kombinasi = Buffer.from(kombinasiBase64, 'base64');
  const salt = kombinasi.subarray(0, 16);
  const enkrip = kombinasi.subarray(16);
  const key = deriveKey(password, salt);
  const dekrip = Buffer.alloc(enkrip.length);
  for (let i = 0; i < enkrip.length; i++) {
    dekrip[i] = enkrip[i] ^ key[i % key.length];
  }
  return dekrip.toString('utf8');
}

async function sembunyikanPesan(imagePath, pesan, outputPath, password = null) {
   console.log(red + ascii2 + reset);
   console.log('sedang mengidentifikasi gambar yg di berikan');

   let dataToHide;
   if (password) {
     dataToHide = encrypt(pesan, password);
     console.log('pesan ini telah di enkripsi dg password ');
   } else {
      dataToHide = Buffer.from(pesan, 'utf8').toString('base64');
      console.log('tidak ada password');
   }

  const image = await Jimp.read(imagePath); // yahh kontol salah cuma gara² kesilip ;
  const width = image.bitmap.width;
  const height = image.bitmap.height;
  const buffer = Buffer.from(dataToHide, 'utf8');
  let binary = '';
  for (const byte of buffer) {
    binary += byte.toString(2).padStart(8, '0');
  }
  const panjangBit = binary.length;
  const panjangBiner = panjangBit.toString(2).padStart(16, '0');
  const fullBiner = panjangBiner + binary;
  const maxBits = width * height * 3;
  if (fullBiner.length > maxBits) {
   throw new Error(`kapasitas pesan terlalu besar! maksimal pesan yaitu ${Math.floor(maxBits / 8)} karakter`);
  }

  let bitIndex = 0;
  image.scan(0, 0, width, height, (x, y, idx) => {
    for (let i = 0; i < 3; i++) {
      if(bitIndex >= fullBiner.length) {
         return;
       }
         const bit = parseInt(fullBiner[bitIndex]);
         image.bitmap.data[idx + i] = (image.bitmap.data[idx + i] & 0xFE) | bit;
         bitIndex++;
    }
  });

   await image.writeAsync(outputPath);
   console.log(`pesan berhasil di sembunyikan di: ${outputPath}`);
   console.log('Gunakan "extract" dg password yang sama jika ada password nya.\n');
}

async function ekstrakPesan(imagePath, password = null) {
   console.log(red + ascii3 + reset);
   console.log('menelusuri pesan yang ada pada gambar..');
   const image = await Jimp.read(imagePath);
   const width = image.bitmap.width;
   const height = image.bitmap.height;

   let binary = '';
   image.scan(0, 0, width, height, (x, y, idx) => {
     for (let i = 0; i < 3; i++) {
       binary += (image.bitmap.data[idx + i] & 1).toString();
     }
  });

   if (binary.length < 16) {
     throw new Error('pesan tersembunyi tidak di temukan alias ga ada pesan tersembunyi, mungkin dikarenakan data terlalu pendek');
   }

   const panjangBit = parseInt(binary.substring(0, 16), 2);
   const payload = binary.substring(16, 16 + panjangBit);
   if (payload.length < panjangBit) {
     throw new Error('panjang tidak cocok, pesan rusak');
   }
   const bytes = [];
   for (let i = 0; i < payload.length; i += 8) {
    const byteStr = payload.slice(i, i + 8);
    if (byteStr.length < 8) {
     break;
    }
    bytes.push(parseInt(byteStr, 2));
   }
   const buffer = Buffer.from(bytes);
   const encoded = buffer.toString('utf8');

   let pesan;
   if (password) {
    try {
     pesan = decrypt(encoded, password);
     console.log('pesan berhasil di deskripsi dg membobol password');
    } catch(error) {
     throw new Error('password salah atau data rusak');
    }
   } else {
      try {
       pesan = Buffer.from(encoded, 'base64').toString('utf8');
       console.log('melakukan proses menemukan pesan');
      } catch (error) { // ganti aja dah biar gampang di mengerti
         throw new Error('proses menemukan pesan gagal');
      }
   }

   console.log('PESAN TELAH DI TEMUKAN');
   console.log(`  "${pesan}" \n`);
   return pesan;
}


const args = process.argv.slice(2);
const command = args[0];
if (!command) {
  console.log(blue + ascii1 + reset);
  console.log(`cara memakai nya:
  node index.js embed <gambar> "<pesan>" <output> [password] # ini digunakan utk menyembunyikan pesan
  node index.js extract <gambar> <password> # digunakan utk mengekstrak gambar agar menampilkan pesan tersembunyi
  `);
  process.exit(0);
}


if (command === 'embed') {
  const [gambar, pesan, output, password] = args.slice(1);
  if (!gambar || !pesan || !output) {
    console.log(' node index.js embed <gambar> "<pesan>" <output> [password]');
    process.exit(0);
  }
  sembunyikanPesan(gambar, pesan, output, password);
} else if (command === 'extract') {
  const [gambar, password] = args.slice(1);
  if (!gambar) {
    console.log('node index.js extract <gambar> <password>');
    process.exit(0);
  }
  ekstrakPesan(gambar, password);
} else {
  console.log('perintah tidak di kenali. silahkan gunakan "embed" / "extract"');
}
