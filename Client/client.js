//node client.js --name David --ip 127.0.0.1 --port 8080
var net = require('net');
var es = require('event-stream'); //import de la lib event-stream
var argv = require('minimist')(process.argv.slice(2));

var me = {
    name: argv.name,
    connected: false
};

var client = new net.Socket();
var ip = argv.ip;
var port = argv.port;
client.connect(port, ip, function() {
    client.write(
        JSON.stringify({
            type: 'connectionQuery',
            name: argv.name
        }));
    process.on('SIGINT', function() {
        client.write(JSON.stringify({
            type: 'connectionEnd',
        }));
    });
    process.stdin.on('readable', function() {
        process.stdin.setEncoding('utf-8');
        var input = process.stdin.read();

        if (input !== null) {
            input = input.slice(0, input.length - 1);
            if (input.startsWith('--')) {
                if (input.startsWith('--quit')) {
                    if (input.indexOf(' ') > -1) {
                        client.write(JSON.stringify({
                            type: 'QuitGroup',
                            groupToQuit: input.substr(input.indexOf(' ') + 1, input.length)
                        }));
                    } else {
                        client.write(JSON.stringify({
                            type: 'connectionEnd',
                        }));
                    }
                }
                if (input == '--help') {
                    console.log('Here is the documentation of the NodeChat\r');
                    console.log('To write to all members connected to NodeChat, type your message and press enter\r\n');
                    console.log('To write to a specific person : #\'personName\'\r');
                    console.log('To show a list of all existing groups : --showGroups\r\n');
                    console.log('To join a group : --join \'groupname\'\r');
                    console.log('To write to a specific group : @\'groupname\' your Message\r');
                    console.log('To list all members of a group : --list \'groupName\'');
                    console.log('To quit a group : --quit \'groupname\'\r\n');
                    console.log('To quit NodeChat press \'Ctrl+C\' or type --quit and press enter\r');
                }
                if (input.startsWith('--showGroups')) {
                    client.write(JSON.stringify({
                        type: 'listOfGroups'
                    }));
                }
                if (input.startsWith('--list')) {
                    if (input.indexOf(' ') > -1)
                        gLis = input.substr(input.indexOf(' ') + 1, input.length);
                    else {
                        gLis = 'general';
                    }
                    client.write(JSON.stringify({
                        type: 'listMembers',
                        groupToList: gLis
                    }));
                }

                if (input.startsWith('--join')) {
                    var indexOfGroupName = input.indexOf(' ');
                    var newGroup = input.substr(indexOfGroupName + 1);
                    client.write(JSON.stringify({
                        type: 'JoinAGroupQuery',
                        to: 'group',
                        groupToJoin: newGroup
                    }));
                }
            } else if (input.startsWith('@')) {

                if (input.startsWith('@test')) {
                    client.write(JSON.stringify({
                        type: 'test'
                    }));
                } else if (input.startsWith('@')) {
                    var groupToWrite = input.substr(1, input.indexOf(' ') - 1);
                    var messageToWrite = input.substr((input.indexOf(' ') + 1), input.length);
                    client.write(JSON.stringify({
                        type: 'message',
                        to: 'group',
                        groupName: groupToWrite,
                        message: messageToWrite
                    }));
                }
            } else if (input.startsWith('#')) {
                var personne = input.substr(1, input.indexOf(' ') - 1);
                var message = input.substr((input.indexOf(' ') + 1), input.length);
                client.write(JSON.stringify({
                    type: 'message',
                    to: 'onePerson',
                    person: personne,
                    message: message
                }));
            } else {
                client.write(
                    JSON.stringify({
                        type: 'message',
                        to: 'all',
                        message: input
                    }));
            }
        }
    });

});
client.on('data', function(data) {

    var donnees = JSON.parse(data);
    if (donnees.hasOwnProperty('type')) {
        if (donnees.type == 'connectionConfirmation') {
            me.id = donnees.id;
            me.connected = donnees.connectionConfirmed;
            if (me.connected)
                console.log('You are now connected    --    For help, type \'--help\'');
            else {
                if (donnees.cause == 'noName')
                    console.log('You have to reconnect and fill the name field');
                else
                    console.log('An error as occured. Please try again later');
            }
        }
        if (donnees.type == 'disconnectionConfirmation') {
            console.log('You are now disconnected');
            client.end();
            me.connected = false;
            process.exit();
        }

        if (donnees.type == 'QuitGroupConfirmation') {
            if (donnees.groupToQuit == 'none')
                console.log('You do not belong to this group');
            else
                console.log("You are now out of the group", donnees.groupToQuit);
        }
        if (donnees.type == 'groupConfirmation') {
            if (donnees.message == 'ok')
                console.log('(From server)  You have now joined the group :', donnees.joinedGroup);
        }

        if (donnees.type == 'error') {
            console.log(donnees.cause, donnees.howTo);
        }

        if (donnees.type == 'listOfGroups') {
            var j = 0;
            var tab = donnees.groups.split(';');
            console.log('You have subscribed to the following groups : \r');
            while (j < tab.length) {
                if (tab[j] !== 'general')
                    console.log('   -' + tab[j] + '\r');
                j++;
            }
        }
        if (donnees.type == 'listOfMembersOfAGroup') {
            var listOfMembers = donnees.list.split(';');
            var k = 0;
            console.log('The members of the group ' + donnees.group + ' are:\r');
            while (k < listOfMembers.length) {
                if (listOfMembers[k])
                    console.log('   -' + listOfMembers[k] + '\r');
                k++;
            }
        }

        if (donnees.type == 'test') {
            console.log(donnees.message);
        }
        if (donnees.type == 'message')
            console.log(donnees.message);

    }

});

client.on('close', function() {
    console.log('Connection closed');
});
