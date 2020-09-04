import * as crypto from 'crypto-js';
import * as eccrypto from 'eccrypto';
import * as moment from 'moment-timezone';
import got from 'got';
import * as inquirer from 'inquirer';
import * as write from 'write';
import * as fs from 'fs';
import * as rString from 'crypto-random-string';
import { KeyValue } from './models';

let privateKey: Buffer;
export async function genPublicKey(){
    const key = eccrypto.generatePrivate();
    console.log(`private(put this in .env): ${key.toString('ascii')}`);
    const pub = eccrypto.getPublic(key);
    console.log(`public key(put this in server .env): ${pub.toString('ascii')}`);
    const result = await inquirer.prompt([{
        type: 'confirm',
        name: 'save',
        message: 'save these?'
    },{
        type: 'confirm',
        name: 'keep',
        message: 'load this key?'
    }]);
    if(result.save) {
        write.sync('private.key', key);
        write.sync('public.key', pub);
    }
    if(result.keep) {
        privateKey = key;
    }
    
}

export async function generateRequest(content: any) {
    const result = {
        content,
        unix: moment().unix(),
        nonce: rString({length:40, type: 'alphanumeric'}),
        hash: '',
    };
    const hash = crypto.SHA3(result.unix+'/'+result.nonce).toString();
    eccrypto.sign(privateKey, new Buffer(hash));
    result.hash = hash;
    return result;
}

export interface user {
    name: string,
    value: string
}

export async function getUserList(): Promise<user[]>{
    let result = await got.post(`${process.env.apiHost}/api/users`, {json: generateRequest(null),responseType: 'json'});
    //@ts-expect-error
    const data: user[] = result.body;
    return data;
}

export function loadPrivateKey(){
    try {
        privateKey = fs.readFileSync('private.key');
        console.log('loaded private key....');
    } catch(error) {
        console.log(error);
    }
}