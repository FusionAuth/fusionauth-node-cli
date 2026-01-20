import {Command} from '@commander-js/extra-typings';
import {FusionAuthClient} from '@fusionauth/typescript-client';
import {readFile} from 'fs/promises';
import chalk from 'chalk';
import {join} from 'path';
import {errorAndExit} from '../utils.js';
import { faker } from '@faker-js/faker';
import * as fs from 'fs';

const action = async function ({numberOfFiles, countPerFile, applicationId, groupId, tmpDir, filePrefix}
: {
    numberOfFiles?: string | undefined;
    countPerFile?: string | undefined;
    applicationId?: string | undefined;
    groupId?: string | undefined;
    tmpDir?: string | undefined;
    filePrefix?: string | undefined;
}
): Promise<void> {
    console.log(`Generating users`);
    try {
        const finalNumberOfFiles = (numberOfFiles !== undefined ? parseInt(numberOfFiles) : 10);
        const finalCountPerFile = (countPerFile !== undefined ? parseInt(countPerFile) : 1000);
        const finalTmpDir = (tmpDir !== undefined ? tmpDir : "tmp");
        const finalFilePrefix = (filePrefix !== undefined ? filePrefix : "output");
        const finalAppId = (applicationId !== undefined ? applicationId : '85a03867-dccf-4882-adde-1a79aeec50df');
        const finalGroupId = (groupId !== undefined ? groupId : 'a730d8c9-d060-4016-935e-170a5baaa4c7');

        // Ensure the tmp directory exists
        if (!fs.existsSync(finalTmpDir)) {
          fs.mkdirSync(finalTmpDir, { recursive: true });
        }

        for (let i = 0; i < finalNumberOfFiles; i++) {
          const jsonData = generateData(finalCountPerFile, finalAppId, finalGroupId, i * finalCountPerFile);
          const filePath = join(finalTmpDir, finalFilePrefix + i);
          fs.writeFile(filePath, JSON.stringify({"users": jsonData}), (err) => {
            if (err) {
              console.error('Error writing to file:', err);
              return;
            }
            //console.log('Data has been written to', filePath);
          });
        }
        console.log(chalk.green(`Users generated`));
    }
    catch (e: unknown) {
        errorAndExit(`Error updating lambda: `, e);
    }
}

// noinspection JSUnusedGlobalSymbols
export const importGenerate = new Command('import:generate')
    .description('Generate sample import data')
    .option('-n, --numberOfFiles <numberOfFiles>', 'The number of files.')
    .option('-c, --countPerFile <countPerFile>', 'The count of records per file.')
    .option('-a, --applicationId <applicationId>', 'The application to register users to.')
    .option('-g, --groupId <groupId>', 'The group id to add users to.')
    .option('-d, --tmpDir <tmpDir>', 'The directory to write files to.', 'tmp')
    .option('-f, --filePrefix <filePrefix>', 'The file prefix for output files.', 'output')
    .action(action);


function generateData(numObjects: number, appId: string, groupId: string, startNumber: number) {
  const data = [];
  for (let i = 0; i < numObjects; i++) {
    const obj = {
      active: true,
      birthDate: faker.date.past().toISOString().split('T')[0],
      data: {
        displayName: faker.person.firstName() + ' ' + faker.person.lastName(),
        favoriteColors: [faker.internet.color(), faker.internet.color()]
      },
      email: `example${i + 1 + startNumber}@example.com`,
      encryptionScheme: 'salted-pbkdf2-hmac-sha256',
      expiry: faker.date.future().getTime(),
      factor: 24000,
      firstName: faker.person.firstName(),
      fullName: faker.person.fullName(),
      imageUrl: faker.image.url(),
      insertInstant: faker.date.past().getTime(),
      lastName: faker.person.lastName(),
      memberships: [
        {
          data: {
            externalId: faker.string.uuid()
          },
          groupId: groupId
        }
      ],
      middleName: faker.person.middleName(),
      mobilePhone: faker.phone.number(),
      password: "yjs0Mj2qttSprPgtTVb+iGNMc66yBawfO1GXVTR3z7g=",
      passwordChangeRequired: false,
      preferredLanguages: ['en_US','en_GB'],
      registrations: [
        {
          applicationId: appId,
          data: {
            birthplace: faker.location.city()
          },
          insertInstant: faker.date.past().getTime(),
          preferredLanguages: ['en_US'],
          username: faker.internet.userName(),
          verified: faker.datatype.boolean()
        }
      ],
      salt: 'k0eyvRy0S8lFp+IArLRGFJrm6dNM3tVGuAztU38lS3A=',
      timezone: faker.location.timeZone(),
      twoFactor: {
        methods: [
          {
            method: 'sms',
            mobilePhone: faker.phone.number()
          },
          {
            method: 'email',
            email: `example${i + 1 + startNumber}@example.com`
          }
        ]
      },
      usernameStatus: 'ACTIVE',
      username: `example${i + 1 + startNumber}`,
      verified: faker.datatype.boolean()
    };
    data.push(obj);
  }
  return data;
}

