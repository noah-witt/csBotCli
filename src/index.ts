import * as dotenv from 'dotenv';
dotenv.config();
import * as inquirer from 'inquirer';
import * as fuzzy from 'fuzzy';
import * as moment from 'moment-timezone';
import * as api from './api';
import * as chalk from 'chalk';
inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));
inquirer.registerPrompt('datetime', require('inquirer-datepicker-prompt'));

interface person {
    name: string,
    value: string
}

let peopleList: person[] = [];

/**
 * @returns a list that matches the input string.
 * @param answersSoFar the previous answers printed.
 * @param input the strings.
 */
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
/**
 * @returns a string that represents the events.
 * @param events the events to get a string for.
 */
function matchStr(events: matchObj[]){
    let result = "";
    events.forEach((e)=>{
        result +=`${chalk.green(e.name)}; ${chalk.blue(e.points)} points; ${moment(e.createdAt).toLocaleString()}\n`;
        const personArr = [];
        e.people.forEach((p) =>{
            personArr.push(`${p.name} <${chalk.red(p.email)}>`);
        });
        result+=`\t with: ${personArr}\n`;
    });
    return result.substr(0, result.length-1);
}
/**
 * prints the events.
 * @param events the events to print
 */
function printMatch(events: matchObj[]){
    console.log(matchStr(events));
}

/**
 * remove an event by selecting through user.
 */
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

/**
 * get data for a user.
 */
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
    console.log(`${pObj.name} ${chalk.red(`<${pObj.email}>`)}; points: ${chalk.blue(pObj.points)}`);
    printMatch(events);
}

/**
 * add an event.
 */
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

/**
 * prints the top scores.
 */
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
        console.log(`${chalk.green(i+1)}. ${e.name} ${chalk.red(`<${e.email}>`)} has ${chalk.blue(e.score)}`);
    }
}

const mainMenuOptions = [
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
];


interface mainMenuOption {
    name: string,
    value: number
}
/**
 * @returns the options that match.
 * @param answersSoFar the previous answers given
 * @param input the string entered
 */
async function getMainMenuItems(answersSoFar, input: string){
    input = input || '';
    const fuzzyOut = fuzzy.filter<mainMenuOption>(input, mainMenuOptions, {extract: function(el) { return el.name; }});
    const results = fuzzyOut.map( function (el) {
        return el.original;
    });
    return results;
}

/**
 * primary loop for control.
 */
async function go() {
    while(true) {
        let actions = await inquirer.prompt([{
            type:'autocomplete',
            name: 'action',
            message: 'select action',
            source: getMainMenuItems
        }]);
        if(actions.action==-1) break;
        try {
            if(actions.action==1) await inspectUser();
            if(actions.action==0) await enterEvent();
            if(actions.action==2) await removeEvent();
            if(actions.action==3) await rank();
            if(actions.action==4) await api.genPublicKey();
        } catch (error) {
            console.warn(chalk.red.bold('that action failed.'));
        }
    }
    return;
}

/**
 * initialize the system.
 */
async function init() {
    const result = await inquirer.prompt([{
        type: 'input',
        name: 'host',
        message: 'enter server host:',
        default: process.env.apiHost
    }]);
    process.env.apiHost = result.host;
    try {
        console.log('loading users...');
        peopleList = await api.getUserList();
        console.log('done loading users.');
    } catch (error) {
        console.log('problem initing');
        console.log('only keygen will work.');
        const gen = await inquirer.prompt([{
            type:'confirm',
            name: 'gen',
            message: 'generate key?'
        }]);
        if(gen.gen) {
            await api.genPublicKey();
        } else {
            console.log('Goodbye...');
        }
        process.exit();
    }
}

/**
 * init and then go.
 */
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