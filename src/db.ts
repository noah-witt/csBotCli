import * as mongoose from 'mongoose';
import * as moment from 'moment-timezone';
export async function init(){
    await mongoose.connect(process.env.MONGO, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });
}
export async function shutdown(){
    await mongoose.disconnect();
    return;
}
import * as models from './models';
export interface matchObj {
    name: string;
    teams: teamObj[];
}
export interface teamObj {
    people: string[];
    points: number;
}

export interface inspectUserResults {
    worked: boolean;
    points: number;
    name: string;
    email: string;
    id: string;
    events: {name: string, points: number, with:Person[], date:string, id:string}[]
}

class Person {
    readonly name: string;
    readonly email: string;
    readonly points: number;
    readonly id: any;
    constructor(name: string, email: string, points: number, id: any){
        this.name = name;
        this.email = email;
        this.points = points;
        this.id = id;
    }
    toString(){
        return `${this.name} <${this.email}>`;
    }
}

export async function inspectUserById(id: string): Promise<inspectUserResults> {
    try {
        let person = await models.Person.findById(id).exec();
        return await inspectUserBack(person);
    } catch {
        return {worked: false, points:0, events:[], name:null, email:null, id:null};
    }
    return {worked: false, points:0, events:[], name:null, email:null, id:null};
} 

export async function inspectUser(email: string): Promise<inspectUserResults> {
    try {
        email = email.trim().toLowerCase();
        let person = await models.Person.findOne({email:email}).exec();
        return await inspectUserBack(person);
    } catch {
        return {worked: false, points:0, events:[], name:null, email:null, id:null};
    }
    return {worked: false, points:0, events:[], name:null, email:null, id:null};
}
async function inspectUserBack(person: models.PersonDoc): Promise<inspectUserResults> {
    try {
        let matches = await models.Match.find({"people": person._id}).sort({createdAt: -1}).populate({path: "people", model:"Person"}).exec();
        if(matches.length<1) return {worked: false, points:0, events:[], name:null, email:null, id:null};
        let events = [];
        let pointCounter =0;
        matches.forEach((e)=>{
            const event = {name: e.name, points: e.points, with:[], date: moment(e.createdAt).format('MMMM Do YYYY, h:mm:ss a z'), id:e._id};
            //add the other people.
            for(let i=0;i<e.people.length;i++) {
                const target = e.people[i];
                if(target instanceof mongoose.mongo.ObjectID) return {worked: false, points:0, events:[], name:null, email:null}; //give up if it fails to populate.
                if(target.email == person.email) continue; //skip this if it is the inspected user.
                event.with.push(new Person(target.name, target.email, target.points, target._id));
            }
            events.push(event);
            pointCounter+=event.points;
        });
        if(pointCounter!=person.points) {
            console.log("POINTS DO NOT MATCH!!!! DATABASE ERROR. User "+person.email+" counter:"+pointCounter+", userEntry:"+person.points);
        }
        return {worked: true, points:person.points, events: events, name:person.name, email:person.email, id:person._id};
    } catch {
        return {worked: false, points:0, events:[], name:null, email:null, id:null};
    }
    return {worked: false, points:0, events:[], name:null, email:null, id:null};;
}

export interface highScoreGetResponse {
    worked: boolean;
    results: {name: string; email:string; score:number; id: string;}[];
}

/**
 * @returns an object that describes the status. 
 * It returns results in sorted order.
 * @param results the number of results
 */
export async function getHighScores(results: number): Promise<highScoreGetResponse> {
    try {
        const result = await models.Person.find({}).sort({points: -1}).limit(results).exec();
        if(result.length==0) return {worked: false, results:[]}; 
        //there are results and now we process them and dump them out.
        let output: highScoreGetResponse = {worked: true, results:[]}
        for(let i=0;i<result.length; i++) {
            let targetUser = result[i];
            output.results.push({name: targetUser.name, email: targetUser.email, score: targetUser.points, id: targetUser._id});
        }
        return output;
    } catch {
        return {worked: false, results:[]};
    }
    return {worked: false, results:[]};
}

export interface dbResponse {
    worked: boolean;
    msg ? : string;
}

/**
 * @returns an object describing the action taken.
 * @param title the title of the adjustment entry
 * @param emails the array of emails
 * @param points  the points to add to each person
 */
export async function newAdjustment(title: string, emails: string[], points: number): Promise < dbResponse > {
    try {
        const e = new models.Match();
        e.name = title;
        e.points =points;
        //assert e.members.length ==1;
        for (let i = 0; i < emails.length; i++) {
            let email = emails[i];
            email = email.trim().toLowerCase();
            if (email.length < 1) return {worked: false,msg: "Check the emails; something looks wrong with them."};
            let emailRecords = await models.Person.find({email: email});
            if (emailRecords.length < 1) return {worked: false,msg: "email \"" + email + "\"  not present in the database."};
            if (emailRecords.length > 1) return {worked: false,msg: "email \"" + email + "\" contains more than one entry in the database. This must be fixed manually using mongoDB."};
            //assert emailRecords.length ==1;
            e.people.push(emailRecords[0]);
            //adjust the user record
            emailRecords[0].points+=points;
            await emailRecords[0].save();
        }
        await e.save();
    } catch {
        return {worked: false, msg:"there was some database error."};
    }
    return {worked: true};
}

/**
 * @returns and object describing if it worked.
 * @param email the users email
 * @param name the users name
 */
export async function newPerson(email: string, name: string): Promise < dbResponse > {
    try {
        email = email.trim().toLowerCase();
        //verify there is no such user.
        let emailRecords = await models.Person.find({email: email});
        if(emailRecords.length!=0) return {worked: false, msg:"this user already exists... update this user instead."};
        //no such user exists
        let user = new models.Person();
        user.email = email;
        user.name = name;
        await user.save();
    } catch {
        return {worked: false, msg:"there was some database error."};
    }
    return {worked: true};
}

export interface removedEventResponse{
    worked: boolean;
    event?:{name: string, points: number, date:string};
}
export async function removeMostRecentMatch(): Promise<removedEventResponse> {
    const responses =  await models.Match.find().sort({createdAt: -1}).limit(1).exec();
    if(responses.length!==1) return {worked: false};
    return await removeByMatchId(responses[0]._id);
}

export async function removeByMatchId(id: any): Promise<removedEventResponse> {
    const response =  await models.Match.findById(id).exec();
    for(let i=0; i<response.people.length;i++){
        let target = response.people[i];
        //subtract the points
        const user = await models.Person.findById(target).exec();
        user.points-=response.points;
        user.save();
    }
    models.Match.findByIdAndDelete(response._id).exec();
    return {worked: true, event:{name: response.name, points: response.points, date: moment(response.createdAt).format('MMMM Do YYYY, h:mm:ss a z')}}
}

export function validateObjectID(id: string): boolean {
    return mongoose.mongo.ObjectID.isValid(id);
}

export async function renameUser(email: string, name: string): Promise<Boolean> {
    try {
        const users = await models.Person.find({email: email}).exec();
        if(users.length!=1) return false;
        const user = users[0];
        user.name = name;
        await user.save();
        return true;
    } catch {
        return false;
    }
    return false;
}