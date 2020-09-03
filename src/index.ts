import * as dotenv from 'dotenv';
dotenv.config();
import * as inquirer from 'inquirer';
import { SSHConnection } from 'node-ssh-forward'
import * as db from './db';
import * as models from './models';
import * as fuzzy from 'fuzzy';
import * as moment from 'moment-timezone';
inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));
inquirer.registerPrompt('datetime', require('inquirer-datepicker-prompt'));

interface person {
    name: string,
    value: string
}

const peopleList: person[] = [];

async function sshConnect() {
    const sshConnection = new SSHConnection({
        endHost: process.env.target,
        endPort: Number.parseInt(process.env.targetPort),
        username: process.env.targetUser,
        privateKey: process.env.privateKey,
        skipAutoPrivateKey: process.env.skipAutoPrivateKey=='true',
        noReadline: true
    });
    await sshConnection.forward({
        fromPort: 27017,
        toPort: 27017,
        toHost: 'localhost'
    });
    return sshConnection;
}

async function getSearchUsers(answersSoFar, input: string){
    input = input || '';
    const fuzzyOut = fuzzy.filter<person>(input, peopleList, {extract: function(el) { return el.name; }});
    const results = fuzzyOut.map( function (el) {
        return el.original;
    });
    return results;
}

function matchStr(events: models.MatchDoc[]){
    let result = "";
    events.forEach((e)=>{
        result +=`${e.name}; ${e.points} points; ${moment(e.createdAt).toLocaleString()}\n`;
        const personArr = [];
        e.people.forEach((p) =>{
            //@ts-expect-error
            personArr.push(`${p.name} <${p.email}>`);
        });
        result+=`\t with: ${personArr}\n`;
    });
    return result.substr(0, result.length-1);
}

function printMatch(events: models.MatchDoc[]){
    console.log(matchStr(events));
}

async function removeEvent(){
    let person = await inquirer.prompt([{
        type:'autocomplete',
        name: 'user',
        message: 'select person',
        source: getSearchUsers
    }]);
    const pObjs = await models.Person.find({email: person.user}).exec();
    if(pObjs.length!=1) throw 'db error';
    const pObj = pObjs[0];
    const events = await models.Match.find({people: pObj._id}).populate('people').sort({'createdAt': -1}).exec();
    console.log(`${pObj.name} <${pObj.email}>; points: ${pObj.points}`);
    const eventSelections = [];
    events.forEach((e)=>{
        let result ="";
        result +=`${e.name}; ${e.points} points; ${moment(e.createdAt).toLocaleString()}\n`;
        const personArr = [];
        e.people.forEach((p) =>{
            //@ts-expect-error
            personArr.push(`${p.name} <${p.email}>`);
        });
        result+=`\t with: ${personArr}\n`;
        eventSelections.push({
            name: result,
            value: e._id,
        });
    });
    if(eventSelections.length==0) return;
    const selection = await inquirer.prompt([{
        type: 'list',
        name: 'event',
        message: 'select an event to remove',
        choices: eventSelections
    }]);

    const cont = await inquirer.prompt({
        type:'confirm',
        name: 'confirm',
        message: 'do you want to continue?'
    });
    if(!cont.confirm) return;
    console.log('processing...');
    db.removeByMatchId(selection.event);
    console.log('done');
}

async function inspectUser(){
    let person = await inquirer.prompt([{
        type:'autocomplete',
        name: 'user',
        message: 'select person',
        source: getSearchUsers
    }]);
    const pObjs = await models.Person.find({email: person.user}).exec();
    if(pObjs.length!=1) throw 'db error';
    const pObj = pObjs[0];
    const events = await models.Match.find({people: pObj._id}).populate('people').exec();
    console.log(`${pObj.name} <${pObj.email}>; points: ${pObj.points}`);
    printMatch(events);
}

async function enterEvent() {
    const people: string[] = [];
    while(true) {
        let a = await inquirer.prompt([{
            type:'autocomplete',
            name: 'user',
            message: 'select person',
            source: getSearchUsers
        },{
            type: 'confirm',
            name: 'another',
            message: 'add another person?'
        }]);
        people.push(a.user);
        if(!a.another) break;
    }
    console.log(`selected: ${people}`);
    let cont = await inquirer.prompt([{
        type: 'confirm',
        name: 'cont',
        message: 'continue?'
    }]);
    if(!cont.cont) return;

    let numAndName = await inquirer.prompt([{
        type: 'number',
        name: 'points',
        message: 'number of points to add'
    }, {
        type: 'input',
        name: 'name',
        message: 'enter event name.'
    }]);
    console.log(`${numAndName.points} to ${people} for "${numAndName.name}"`);
    let confirm = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: 'Keep these changes?'
    }]);
    if(!confirm.confirm) return;
    console.log('processing...');
    await db.newAdjustment(numAndName.name, people, numAndName.points);
    console.log('changes applied');
}

async function rank(){
    let count = await inquirer.prompt([{
        type: 'number',
        name: 'num',
        message: 'number of results to show',
        default: 10 
    }]);
    if(count.count<0) count.count*=-1;
    const responses = await db.getHighScores(count.num);
    for(let i=0; i<responses.results.length; i++) {
        const e = responses.results[i];
        console.log(`${i+1}. ${e.name} <${e.email}> has ${e.score}`);
    }
}

async function go() {
    while(true) {
        let actions = await inquirer.prompt([{
            type: 'list',
            name: 'action',
            message: 'What Action',
            choices: [
                {
                    name: 'exit',
                    value: -1
                },
                {
                    name: 'enter score',
                    value: 0
                },
                {
                    name: 'inspect user',
                    value: 1
                },
                {
                    name: 'remove event',
                    value: 2
                },
                {
                    name: 'rank',
                    value: 3
                },
            ],
        }]);
        if(actions.action==-1) break;
        
        if(actions.action==1) await inspectUser();
        if(actions.action==0) await enterEvent();
        if(actions.action==2) await removeEvent();
        if(actions.action==3) await rank();
    }
    return;
}

async function init() {
    console.log('loading users...');
    const temp = await models.Person.find({}).sort('email').exec();
    if(temp.length ==0) throw 'db error';
    if(typeof temp[0].email == 'undefined') throw 'db error';
    for(let i=0; i< temp.length; i++) {
        const target = temp[i];
        //@ts-ignore
        peopleList.push({name: `${target.name} <${target.email}>`, value: target.email});
    }
    console.log('done loading users.');
}

async function manage() {
    let sshConnection;
    if(process.env.disableIntegratedSSH!=='true') sshConnection = await sshConnect();
    try {
        await db.init();
        await init();
        await go();
    } catch (error) {
        console.log(error);
    }
    if(process.env.disableIntegratedSSH!=='true') await sshConnection.shutdown();
    await db.shutdown();
    process.exit();
}
manage();