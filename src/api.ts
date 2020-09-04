import * as crypto from 'crypto-js';
import * as moment from 'moment-timezone';
import got from 'got';
import * as inquirer from 'inquirer';
import * as write from 'write';
import * as fs from 'fs';
import * as rString from 'crypto-random-string';

let privateKey: string;
export async function genPublicKey(){
    const key = rString({length:100, type:'url-safe'});
    console.log(`private(private.key): ${key}`);
    const pub = crypto.enc.Base64.stringify(crypto.SHA3(key));
    console.log(`public key(public.key): ${pub}`);
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

export async function generateRequestObj<T>(content: T) {
    const result = {
        content,
        unix: moment().unix(),
        nonce: rString({length:40, type: 'alphanumeric'}),
        key: '',
    };
    result.key = privateKey;
    return result;
}

export interface user {
    name: string,
    value: string
}

export async function getUserList(): Promise<user[]>{
    //console.log(generateRequestObj(null));
    let result = await got.post(`${process.env.apiHost}/api/users`, {json: await generateRequestObj(null),responseType: 'json'});
    //@ts-expect-error
    const data: user[] = result.body;
    return data;
}

export async function newAdjustment(name: string, people: string[], points: number): Promise<null> {
    let result = await got.post(`${process.env.apiHost}/api/adjustment`, {json: await generateRequestObj({name, people, points}),responseType: 'json'});
    return null;
}

export interface userInspectionResult {
    person: {
        name: string;
        email: string;
        points: string;
    };
    events: {
        name: string;
        points: number;
        createdAt: number;
        _id: string;
        people: {
            name: string;
            email: string;
        }[]
    }[];
}

export async function inspectUser(email: string): Promise<userInspectionResult> {
    let result = await got.post<userInspectionResult>(`${process.env.apiHost}/api/inspectUser`, {json: await generateRequestObj(email),responseType: 'json'});
    return result.body;
}

export interface rankOutput{
    name: string,
    email: string,
    score: number,
}

export async function getRankList(results: number): Promise<rankOutput[]> {
    let result = await got.post(`${process.env.apiHost}/api/rank`, {json: await generateRequestObj(results),responseType: 'json'});
    //@ts-expect-error
    const data: rankOutput[] = result.body;
    return data;
}

export async function remove(id: string): Promise<null> {
    let result = await got.post(`${process.env.apiHost}/api/remove`, {json: await generateRequestObj(id),responseType: 'json'});
    return null;
}

export function loadPrivateKey(){
    try {
        privateKey = fs.readFileSync('private.key').toString();
        console.log('loaded private key....');
    } catch(error) {
        console.log(error);
    }
}