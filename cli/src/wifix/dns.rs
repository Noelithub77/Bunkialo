use super::PORTAL_HOST;
use crate::common::CliResult;
use hickory_proto::op::{Message, MessageType, OpCode, Query, ResponseCode};
use hickory_proto::rr::{Name, RData, RecordType};
use std::net::{Ipv4Addr, SocketAddr, UdpSocket};
use std::time::Duration;

pub(super) fn resolve(local: Ipv4Addr, servers: &[Ipv4Addr]) -> CliResult<Ipv4Addr> {
    for server in servers {
        match query(local, SocketAddr::from((*server, 53))) {
            Ok(address) => {
                println!("Portal DNS: {server} → {address}");
                return Ok(address);
            }
            Err(_) => eprintln!(
                "Campus DNS server {server} did not resolve the portal; trying the next server."
            ),
        }
    }
    Err(
        "Campus DNS could not resolve auth.iiitkottayam.ac.in. Reconnect campus Wi-Fi and retry."
            .into(),
    )
}

fn query(local: Ipv4Addr, server: SocketAddr) -> CliResult<Ipv4Addr> {
    let socket =
        UdpSocket::bind((local, 0)).map_err(|_| "Could not bind campus Wi-Fi DNS socket.")?;
    socket
        .set_read_timeout(Some(Duration::from_secs(2)))
        .map_err(|_| "Could not set DNS timeout.")?;
    socket
        .set_write_timeout(Some(Duration::from_secs(2)))
        .map_err(|_| "Could not set DNS timeout.")?;
    socket
        .connect(server)
        .map_err(|_| "Could not reach campus DNS server.")?;
    let mut request = Message::new(rand::random(), MessageType::Query, OpCode::Query);
    request.metadata.recursion_desired = true;
    request.add_query(Query::query(
        Name::from_ascii(format!("{PORTAL_HOST}.")).map_err(|_| "Invalid portal DNS name.")?,
        RecordType::A,
    ));
    let bytes = request
        .to_vec()
        .map_err(|_| "Could not encode DNS query.")?;
    socket
        .send(&bytes)
        .map_err(|_| "Campus DNS query failed.")?;
    let mut buffer = [0; 4096];
    let size = socket
        .recv(&mut buffer)
        .map_err(|_| "Campus DNS query timed out.")?;
    let response = Message::from_vec(&buffer[..size])
        .map_err(|_| "Campus DNS returned a malformed response.")?;
    address_from_response(&request, &response)
}

fn address_from_response(request: &Message, response: &Message) -> CliResult<Ipv4Addr> {
    if response.metadata.id != request.metadata.id
        || response.metadata.message_type != MessageType::Response
        || response.metadata.op_code != OpCode::Query
        || response.metadata.response_code != ResponseCode::NoError
        || response.metadata.truncation
        || response.queries != request.queries
    {
        return Err("Campus DNS returned an unexpected or incomplete response.".into());
    }
    let mut name = request.queries[0].name().clone();
    // Follow only the queried name's CNAME chain; ignore unrelated answer records.
    for _ in 0..8 {
        for record in &response.answers {
            if record.name == name {
                if let RData::A(address) = record.data {
                    if !address.0.is_unspecified()
                        && !address.0.is_loopback()
                        && !address.0.is_multicast()
                    {
                        return Ok(address.0);
                    }
                }
            }
        }
        let alias = response.answers.iter().find_map(|record| {
            if record.name == name {
                if let RData::CNAME(alias) = &record.data {
                    return Some(alias.0.clone());
                }
            }
            None
        });
        let Some(alias) = alias else {
            break;
        };
        name = alias;
    }
    Err("Campus DNS returned no usable portal IPv4 address.".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use hickory_proto::rr::{rdata::A, Record};
    #[test]
    fn queries_wifi_dns_and_validates_transaction() {
        let server = UdpSocket::bind((Ipv4Addr::LOCALHOST, 0)).unwrap();
        server
            .set_read_timeout(Some(Duration::from_secs(3)))
            .unwrap();
        let address = server.local_addr().unwrap();
        let worker = std::thread::spawn(move || {
            let mut buffer = [0; 4096];
            let (size, peer) = server.recv_from(&mut buffer).unwrap();
            let request = Message::from_vec(&buffer[..size]).unwrap();
            let mut response = Message::response(request.metadata.id, OpCode::Query);
            response.queries = request.queries;
            response.add_answer(Record::from_rdata(
                Name::from_ascii(format!("{PORTAL_HOST}.")).unwrap(),
                60,
                RData::A(A(Ipv4Addr::new(10, 2, 0, 1))),
            ));
            server.send_to(&response.to_vec().unwrap(), peer).unwrap();
        });
        assert_eq!(
            query(Ipv4Addr::LOCALHOST, address).unwrap(),
            Ipv4Addr::new(10, 2, 0, 1)
        );
        worker.join().unwrap();
    }
    #[test]
    fn rejects_wrong_id_and_unrelated_answers() {
        let mut request = Message::new(42, MessageType::Query, OpCode::Query);
        request.add_query(Query::query(
            Name::from_ascii(format!("{PORTAL_HOST}.")).unwrap(),
            RecordType::A,
        ));
        let mut response = Message::response(43, OpCode::Query);
        response.queries = request.queries.clone();
        response.add_answer(Record::from_rdata(
            Name::from_ascii("other.example").unwrap(),
            60,
            RData::A(A(Ipv4Addr::new(10, 2, 0, 1))),
        ));
        assert!(address_from_response(&request, &response).is_err());
        response.metadata.id = 42;
        assert!(address_from_response(&request, &response).is_err());
    }
}
