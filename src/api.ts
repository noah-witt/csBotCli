import * as crypto from 'crypto-js';
import * as moment from 'moment-timezone';
import got from 'got';
import * as inquirer from 'inquirer';
import * as write from 'write';
import * as fs from 'fs';
import * as rString from 'crypto-random-string';
/**
 * the string of the private key.
 */
let privateKey: string;

/**
 * generates the public key part
 */
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
/**
 * @returns the object to be sent.
 * @param content the body content
 */
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

/**
 * gets the list of users to init the system.
 */
export async function getUserList(): Promise<user[]>{
    //console.log(generateRequestObj(null));
    let result = await got.post(`${process.env.apiHost}/api/users`, {json: await generateRequestObj(null),responseType: 'json'});
    //@ts-expect-error
    const data: user[] = result.body;
    return data;
}

/**
 * adds an event.
 * @param name the name of the event
 * @param people the emails of the people.
 * @param points the number of points
 */
export async function newAdjustment(name: string, people: string[], points: number): Promise<null> {
    let result = await got.post(`${process.env.apiHost}/api/adjustment`, {json: await generateRequestObj({name, people, points}),responseType: 'json'});
    return null;
}

/**
 * represents the object from the server
 */
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
/**
 * @returns the user requested.
 * @param email the email of the user
 */
export async function inspectUser(email: string): Promise<userInspectionResult> {
    let result = await got.post<userInspectionResult>(`${process.env.apiHost}/api/inspectUser`, {json: await generateRequestObj(email),responseType: 'json'});
    return result.body;
}

export interface rankOutput{
    name: string,
    email: string,
    score: number,
}

/**
 * @returns the specified number of top scores.
 * @param results the number of results you want.
 */
export async function getRankList(results: number): Promise<rankOutput[]> {
    let result = await got.post(`${process.env.apiHost}/api/rank`, {json: await generateRequestObj(results),responseType: 'json'});
    //@ts-expect-error
    const data: rankOutput[] = result.body;
    return data;
}

/**
 * removes the event by the specified ID.
 * @param id the event id to remove
 */
export async function remove(id: string): Promise<null> {
    let result = await got.post(`${process.env.apiHost}/api/remove`, {json: await generateRequestObj(id),responseType: 'json'});
    return null;
}

/**
 * load a private key from private.key.
 */
export function loadPrivateKey(){
    try {
        privateKey = fs.readFileSync('private.key').toString();
        console.log('loaded private key....');
    } catch(error) {
        console.log(error);
    }
}