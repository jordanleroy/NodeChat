var net = require('net'); //import de la lib net
var es = require('event-stream'); //import de la lib event-stream
var mini = require('minimist'); //import de la lib minimist

var connectionCounter=1;

var clients_array=[];

var j;

var server = net.createServer(function(socket){
	socket.setEncoding('utf8');
	socket.on('data', function(data){
		//console.log(data);
		var donnees = JSON.parse(data);
		if (donnees.hasOwnProperty('type'))
		{
			if(donnees.type=='connectionQuery'){
				if(donnees.name !== '' && donnees.name !== null){
					socket.write(JSON.stringify(
						{
							type:'connectionConfirmation',
							connectionConfirmed:true,
							cause:null
						}));
					socket.id=connectionCounter;
					socket.name=donnees.name;
					socket.group='general';
					clients_array.push(socket);
					connectionCounter++;
				}else{
					socket.write(JSON.stringify(
						{
							type:'connectionConfirmation',
							connectionConfirmed:false,
							cause:'noName'
						}));
				}
			}

			if(donnees.type=='JoinAGroupQuery'){
				socket.group=socket.group + ';' +donnees.groupToJoin;
				socket.write(JSON.stringify({
					type:'groupConfirmation',
					message:'ok',
					joinedGroup:donnees.groupToJoin
				}));
			}

			if(donnees.type=='connectionEnd'){
				console.log('Fermeture de connexion' +socket.id);
				socket.write(JSON.stringify(
				{
					type:'disconnectionConfirmation',
					connected:'false'
				}));
				j=0;
				while(clients_array[j]){
					if(clients_array[j].id == socket.id)
						clients_array[j].splice(j, 1);
					j++;
				}
			}
			if(donnees.type=='QuitGroup'){
				socket.group=socket.group.replace(';' + donnees.groupToQuit, '');
				console.log(socket.group);
				socket.write(JSON.stringify({
					type:'QuitGroupConfirmation',
					groupToQuit:donnees.groupToQuit
				}));
			}

			if(donnees.type=='listOfGroups'){
				socket.write(JSON.stringify({
					type:'listOfGroups',
					groups:socket.group
				}));
			}

			if(donnees.type=='listMembers'){
				var members = '';
				j=0;
				while(j<clients_array.length){
					if(clients_array[j].group.indexOf(donnees.groupToList)>-1)
						members+=clients_array[j].name+';';
					j++;
				}
				socket.write(JSON.stringify({
					type:'listOfMembersOfAGroup',
					group:donnees.groupToList,
					list:members
				}));
			}

			if(donnees.type=='message'){
				if(donnees.to=='all'){
					j = 0;
					while(j<clients_array.length){
						if(socket.id !== clients_array[j].id){
							clients_array[j].write(JSON.stringify(
							{
								type:'message',
								message:'' + donnees.message + ' (From ' + socket.name + ')'
							}));
						}
						j++;
					}
				}
				else if(donnees.to=='group'){
					j=0;
					while(clients_array[j].id!==socket.id){
						j++;
					}
					groupToWrite=socket.group;
					SubscribedGroupsBySocket=clients_array[j].group;
					if(SubscribedGroupsBySocket.indexOf(donnees.groupName)>-1){
						j = 0;
						while(j<clients_array.length){
							if(socket.id !== clients_array[j].id && clients_array[j].group.indexOf(donnees.groupName) > -1){
								clients_array[j].write(JSON.stringify(
								{
									type:'message',
									message:'@' + donnees.groupName + ' ' +donnees.message + ' (From ' + socket.name + ')'
								}));
							}
							j++;
						}
					}
					else{
						socket.write(JSON.stringify({
							type:'error',
							cause:'You have not subscribe to this group',
							howTo:'please use \'--join groupName\' command'
						}));
					}

				}
			}
		}

		//console.log(data);
	});
	socket.on('error', console.error);
});
server.listen(8080, '127.0.0.1');
