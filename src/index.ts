import * as dotenv from 'dotenv';
dotenv.config();
import * as inquirer from 'inquirer';
import * as fuzzy from 'fuzzy';
import * as moment from 'moment-timezone';
import * as api from './api';
inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));
inquirer.registerPrompt('datetime', require('inquirer-datepicker-prompt'));

interface person {
    name: string,
    value: string
}

let peopleList: person[] = [];


async function getSearchUsers(answersSoFar, input: string){
    input = input || '';
    const fuzzyOut = fuzzy.filter<person>(input, peopleList, {extract: function(el) { return el.name; }});
    const results = fuzzyOut.map( function (el) {
        return el.original;
    });
    return results;
}

interface matchObj {
    points: number;
    createdAt: number;
    name: string;
    people: {
        name: string,
        email: string
    }[];
}

function matchStr(events: matchObj[]){
    let result = "";
    events.forEach((e)=>{
        result +=`${e.name}; ${e.points} points; ${moment(e.createdAt).toLocaleString()}\n`;
        const personArr = [];
        e.people.forEach((p) =>{
            personArr.push(`${p.name} <${p.email}>`);
        });
        result+=`\t with: ${personArr}\n`;
    });
    return result.substr(0, result.length-1);
}

function printMatch(events: matchObj[]){
    console.log(matchStr(events));
}

async function removeEvent(){
    let person = await inquirer.prompt([{
        type:'autocomplete',
        name: 'user',
        message: 'select person',
        source: getSearchUsers
    }]);
    const result = await api.inspectUser(person.user);
    const pObj = result.person;
    const events = result.events;
    console.log(`${pObj.name} <${pObj.email}>; points: ${pObj.points}`);
    const eventSelections = [];
    events.forEach((e)=>{
        let result ="";
        result +=`${e.name}; ${e.points} points; ${moment(e.createdAt).toLocaleString()}\n`;
        const personArr = [];
        e.people.forEach((p) =>{
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
    await api.remove(selection.event);
    console.log('done');
}

async function inspectUser(){
    let person = await inquirer.prompt([{
        type:'autocomplete',
        name: 'user',
        message: 'select person',
        source: getSearchUsers
    }]);
    const result = await api.inspectUser(person.user);
    const pObj = result.person;
    const events = result.events;
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
    await api.newAdjustment(numAndName.name, people, numAndName.points);
    console.log('changes applied');
}

async function rank(){
    let count = await inquirer.prompt([{
        type: 'number',
        name: 'num',
        message: 'number of results to show',
        default: 10 
    }]);
    if(count.num<0) count.num*=-1;
    const responses = await api.getRankList(count.num);
    for(let i=0; i<responses.length; i++) {
        const e = responses[i];
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
                {
                    name: 'generate a key pair',
                    value: 4
                },
            ],
        }]);
        if(actions.action==-1) break;
        
        if(actions.action==1) await inspectUser();
        if(actions.action==0) await enterEvent();
        if(actions.action==2) await removeEvent();
        if(actions.action==3) await rank();
        if(actions.action==4) await api.genPublicKey();
    }
    return;
}

async function init() {
    try {
        console.log('loading users...');
        peopleList = await api.getUserList();
        console.log('done loading users.');
    } catch (error) {
        console.log('problem initing');
        console.log('only keygen will work.');
        await api.genPublicKey();
        process.exit();
    }
}

async function manage() {
    api.loadPrivateKey();
    try {
        await init();
        await go();
    } catch (error) {
        console.log(error);
    }
    process.exit();
}
manage();