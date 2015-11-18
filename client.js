/*
/ node client.js --name David --ip 127.0.0.1 --port 8080
*/
var net  = require('net');
var argv = require('minimist')(process.argv.slice(2));
var connectionPort;

if(argv.port !== '')
    connectionPort = argv.port;
else {
    connectionPort = '8080';
}

var client = new net.Socket();
client.connect(argv.port, argv.ip, function() {
    client.write(JSON.stringify({
        type: 'connectionRequest',
        name: argv.name
    }));
    console.log('Connecting... Waiting for response...');
});

client.on('close', function() {
    console.log('Connection closed');
    process.exit();
});



///////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////       RECEIVE       ////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////
client.on('data', function(data) {
    var json_data = JSON.parse(data);

    switch (json_data.type) {
        case 'connectionConfirmation':
            console.log('You are now connected with ID: ' + json_data.id);
            console.log('For help, type \'--help\'');
            break;
        case 'disconnectionConfirmation':
            client.end();
            console.log('You are now disconnected');
            process.exit();
            break;
        case 'joinGroupConfirmation':
            console.log('You now belong to these groups :', json_data.groups);
            break;
        case 'leaveGroupConfirmation':
            console.log("You are now out of the group", json_data.leftGroup);
            break;
        case 'listOfGroups':
            console.log('You belong to these groups :', json_data.groups);
            break;
        case 'listOfMembersOfAGroup':
            console.log('The members of the group %s are : ' + json_data.members, json_data.group);
            break;
        case 'message':
            console.log('[%s][%s]: %s', json_data.destination, json_data.sender, json_data.message);
            break;
        case 'error':
            console.error(json_data.cause);
            if (json_data.howTo)
                console.error(json_data.howTo);
            if (json_data.fatal)
                disconnect();
            break;
    }
});









///////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////       SEND       //////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////
process.stdin.on('readable', function() {
    process.stdin.setEncoding('utf-8');
    var input = process.stdin.read();
    if (input) {
        input = input.trim(); // remove trailing whitespace

        if (input.startsWith('--')) {
            if (input === '--help') {
                console.log('This is the documentation for NodeChat.js\r\n');
                console.log('To show a list of all groups you\'ve joined: --list-groups\r\n');
                console.log('To join a group: --join \'groupname\'\r');
                console.log('To leave a group: --leave \'groupname\'\r\n');
                console.log('To list all members of a specific group: --list-members \'groupName\'\n');
                console.log('To write to all members of all your groups: just type your message directly\r');
                console.log('To write to a specific group: @groupname message\r');
                console.log('To write to a specific person: #personName message\r\n');
                console.log('To exit NodeChat: press \'Ctrl+C\' or type --exit\r');
            }

            if (input === '--list-groups') {
                client.write(JSON.stringify({
                    type: 'listGroups'
                }));
            }

            if (input.startsWith('--join')) {
                if (input.split(' ').length < 2) {
                    console.error('please include group name');
                } else {
                    var groupToJoin = input.split(' ');
                    groupToJoin.shift();
                    groupToJoin = groupToJoin.join(' ');
                    client.write(JSON.stringify({
                        type        : 'joinGroup',
                        groupToJoin : groupToJoin
                    }));
                }
            }

            if (input.startsWith('--leave')) {
                if (input.split(' ').length < 2) {
                    console.error('please include group name');
                } else {
                    var groupToLeave = input.split(' ');
                    groupToLeave.shift();
                    groupToLeave = groupToLeave.join(' ');
                    client.write(JSON.stringify({
                        type         : 'leaveGroup',
                        groupToLeave : groupToLeave
                    }));
                }
            }

            if (input.startsWith('--list-members')) {
                if (input.split(' ').length < 2) {
                    console.error('please include group name');
                } else {
                    var groupToList = input.split(' ');
                    groupToList.shift();
                    groupToList = groupToList.join(' ');
                    client.write(JSON.stringify({
                        type        : 'listMembers',
                        groupToList : groupToList
                    }));
                }
            }


            if (input === '--exit') {
                disconnect();
            }
        } else if (input.startsWith('@')) {
            var groupName = input.split(' ')[0].substr(1); // also remove the @ symbol
            if (!groupName) {
                console.error('please include group name');
            } else if (input.split(' ').length < 2) {
                    console.error('please include a message');
            } else {
                var groupMessage = input.split(' ');
                groupMessage.shift();
                groupMessage = groupMessage.join(' ');
                client.write(JSON.stringify({
                    type        : 'message',
                    destination : 'multicast',
                    groupName   : groupName,
                    message     : groupMessage
                }));
            }
        } else if (input.startsWith('#')) {
            var receiver = input.split(' ')[0].substr(1); // also remove the # symbol
            if (!receiver) {
                console.error('please include receiver\'s name');
            } else if (input.split(' ').length < 2) {
                    console.error('please include a message');
            } else {
                var message = input.split(' ');
                message.shift();
                message = message.join(' ');
                client.write(JSON.stringify({
                    type        : 'message',
                    destination : 'unicast',
                    receiver    : receiver,
                    message     : message
                }));
            }
        } else {
            var broadcastMessage = input;
            client.write(JSON.stringify({
                type        : 'message',
                destination : 'broadcast',
                message     : broadcastMessage
            }));
        }
    }
});




function disconnect() {
    client.write(JSON.stringify({
        type: 'connectionEnd'
    }));
}


process.on('SIGINT', function() {
    disconnect();
});
