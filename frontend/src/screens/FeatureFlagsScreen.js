import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { Table, Badge } from 'react-bootstrap'
import Loader from '../components/Loader'
import Message from '../components/Message'

const statusVariant = (status) => {
  if (status === 'Enabled') return 'success'
  if (status === 'Disabled') return 'danger'
  return 'warning'
}

const FeatureFlagsScreen = () => {
  const [flags, setFlags] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    axios
      .get('/api/features')
      .then(({ data }) => {
        setFlags(Object.entries(data))
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  if (loading) return <Loader />
  if (error) return <Message variant='danger'>{error}</Message>

  const counts = flags.reduce(
    (acc, [, f]) => ({ ...acc, [f.status]: (acc[f.status] || 0) + 1 }),
    {}
  )

  return (
    <>
      <h1>Feature Flags</h1>
      <div className='mb-3'>
        <Badge variant='success' className='mr-2'>
          Enabled: {counts.Enabled || 0}
        </Badge>{' '}
        <Badge variant='warning' className='mr-2'>
          Testing: {counts.Testing || 0}
        </Badge>{' '}
        <Badge variant='danger'>Disabled: {counts.Disabled || 0}</Badge>
      </div>
      <Table striped bordered hover responsive size='sm'>
        <thead>
          <tr>
            <th>Key</th>
            <th>Name</th>
            <th>Status</th>
            <th>Traffic %</th>
            <th>Segments</th>
            <th>Last Modified</th>
            <th>Dependencies</th>
          </tr>
        </thead>
        <tbody>
          {flags.map(([key, flag]) => (
            <tr key={key}>
              <td>
                <code>{key}</code>
              </td>
              <td>{flag.name}</td>
              <td>
                <Badge variant={statusVariant(flag.status)}>
                  {flag.status}
                </Badge>
              </td>
              <td>{flag.traffic_percentage}%</td>
              <td>{flag.targeted_segments.join(', ')}</td>
              <td>{flag.last_modified}</td>
              <td>{flag.dependencies ? flag.dependencies.join(', ') : '—'}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  )
}

export default FeatureFlagsScreen
