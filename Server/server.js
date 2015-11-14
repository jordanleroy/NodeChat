var net  = require('net'); //import de la lib net

var clients_array = [];

var server = net.createServer(function(socket) {
    socket.setEncoding('utf8');

    socket.on('data', function(data) {
        var json_data = JSON.parse(data);
        switch (json_data.type) {
            case 'connectionRequest': // CLIENT wants to connect
                connectClient(socket, json_data);
                break;
            case 'joinGroup': // CLIENT wants to join a group
                addClientToGroup(socket, json_data);
                break;
            case 'leaveGroup': // CLIENT wants to leave a group
                removeClientFromGroup(socket, json_data);
                break;
            case 'connectionEnd': // CLIENT wants to disconnect
                disconnectClient(socket);
                break;
            case 'listOfGroups': // CLIENT wants to know the groups he's connected to
                listGroupsForClient(socket);
                break;
            case 'listMembers': // CLIENT wants to know the participants of a specified group
                listMembersOfGroup(socket, json_data);
                break;
            case 'message': // CLIENT wants to send a message
                sendMessage(socket, json_data);
                break;
        }
    });
    socket.on('error', console.error);
});
server.listen(8080, '127.0.0.1');





function connectClient(socket, json_data) {
    socket.write(JSON.stringify({
        type: 'connectionConfirmation',
        connectionConfirmed: true
    }));
    socket.id     = generateUID(); // Generate unique ID in case two clients have the same name
    socket.name   = json_data.name;
    socket.groups = ['general'];

    // Tell all participants that this client is connected
    clients_array.forEach(function(client) {
        client.write(JSON.stringify({
            type    : 'message',
            to      : 'all',
            message : socket.name + ' is now connected'
        }));
    });

    clients_array.push(socket);
}


function addClientToGroup(socket, json_data) {
    socket.groups.push(json_data.groupToJoin);
    socket.write(JSON.stringify({
        type         : 'joinGroupConfirmation',
        message      : 'ok',
        joinedGroups : socket.groups
    }));

    // Tell group participants that this client has joined the group
    clients_array.forEach(function(client) {
        if (client.groups.indexOf(json_data.groupToJoin) > -1 && client.id !== socket.id)
            client.write(JSON.stringify({
                type    : 'message',
                message : socket.name + ' has now joined @' + json_data.groupToJoin
            }));
    });
}


function removeClientFromGroup(socket, json_data) {
    var group_index = socket.groups.indexOf(json_data.groupToQuit);
    if (group_index > -1) {
        socket.groups.splice(group_index, 1);
        socket.write(JSON.stringify({
            type         : 'leaveGroupConfirmation',
            joinedGroups : socket.groups
        }));
    } else {
        socket.write(JSON.stringify({
            type  : 'leaveGroupConfirmation',
            error : 'You don\'t belong to this group'
        }));
    }
}


function disconnectClient(socket) {
    console.log('Fermeture de connexion pour ' + socket.id);

    socket.write(JSON.stringify({
        type      : 'disconnectionConfirmation',
        connected : 'false'
    }));

    // Remove client from our local list
    var client_index = clients_array.indexOf(socket);
    clients_array.splice(client_index, 1);
}


function listGroupsForClient(socket) {
    socket.write(JSON.stringify({
        type   : 'listOfGroups',
        groups : socket.groups
    }));
}


function listMembersOfGroup(socket, json_data) {
    var members = [];
    var list_group_index = socket.groups.indexOf(json_data.groupToList);
    if (list_group_index > -1) {
        clients_array.forEach(function(client) {
            list_group_index = client.groups.indexOf(json_data.groupToList);
            if (list_group_index > -1) members.push(client.name);
        });

        socket.write(JSON.stringify({
            type  : 'listOfMembersOfAGroup',
            group : json_data.groupToList,
            list  : members
        }));
    } else {
        socket.write(JSON.stringify({
            type  : 'listOfMembersOfAGroup',
            error : 'you don\'t belong to this group'
        }));
    }
}


function sendMessage(socket, json_data) {
    // Check the 'to' property to see the desired recipients
    switch (json_data.to) {
        case 'all': //write to all persons connected to the NodeChat
            sendBroadcastMessage(socket, json_data);
            break;
        case 'single': //write to only one person
            sendSingleMessage(socket, json_data);
            break;
        case 'group': //write to all members of the specified group
            sendGroupMessage(socket, json_data);
            break;
        default:
            // TODO: display error
            break;

    }
}


function sendBroadcastMessage(socket, json_data) {
    clients_array.forEach(function(client) {
        if (socket.id !== client.id) {
            client.write(JSON.stringify({
                type    : 'message',
                message : '[BROADCAST][' + socket.name + ']' + json_data.message
            }));
        }
    });
}


function sendSingleMessage(socket, json_data) {
    if ( !clients_array.some(function (client){ // this function return false if it doesn't find any client
        if (client.name === json_data.person) {
            client.write(JSON.stringify({
                type: 'message',
                message: '(From ' + socket.name + ' to you) ' + json_data.message
            }));
            return true;
        }
    })) {
        socket.write(JSON.stringify({
            type: 'error',
            cause: 'Client not found.',
            howTo: 'Please check the client name for typos.'
        }));
    }
}


function sendGroupMessage(socket, json_data) {
    if (socket.groups.indexOf(json_data.groupName) > -1) { // Verify the user belongs to the group
        clients_array.forEach(function (client){
            if (socket.id !== client.id && client.groups.indexOf(json_data.groupName) > -1) {
                client.write(JSON.stringify({
                    type: 'message',
                    message: '(From ' + socket.name + ' to @' + json_data.groupName + ') ' + json_data.message
                }));
            }
        });
    } else {
        socket.write(JSON.stringify({
            type: 'error',
            cause: 'You have not subscribed to this group',
            howTo: 'please use \'--join groupName\' command'
        }));
    }
}


function generateUID() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}
